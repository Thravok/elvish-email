# ADR 0006 — Own SMTP stack (supersedes 0002)

**Status:** Accepted (2026-05)
**Supersedes:** [0002 — Mail transport via go-smtp](./0002-mail-transport-go-smtp.md)
**Related:** [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md)

## Context

ADR 0002 chose `github.com/emersion/go-smtp` and `github.com/emersion/go-sasl` for the inbound MX listener and submission server. We now need to:

- Reduce supply chain surface area: the SMTP stack is the public-facing edge of an E2EE service; a malicious or compromised dependency could exfiltrate plaintext bodies during the brief gateway-encryption window.
- Add features go-smtp doesn't expose cleanly (per-IP throttling that talks to Valkey, custom enhanced status codes, hooking DKIM signing into the outbound client).
- Own DKIM signing in-tree (RFC 6376) so we can rotate selectors and pick algorithms (RSA vs Ed25519) without waiting on a dependency upgrade.

Building a minimal SMTP server is a tractable amount of code (~600 LOC across `internal/smtp/{wire,sasl,server,client}`). RFC 5321 is a stable spec. The cost of owning it is offset by removing two third-party deps from the trust boundary.

## Decision

Replace `internal/smtpserver` and `internal/smtpout` with `internal/smtp/{wire,sasl,server,client}`:

- **`internal/smtp/wire`** — line reader/writer with CRLF framing, command parsing, multi-line replies, dot-stuffed DATA reader, typed `SMTPError` (code + enhanced status + message).
- **`internal/smtp/sasl`** — AUTH PLAIN (RFC 4616) and AUTH LOGIN (de facto). No CRAM-MD5 (depreciated, requires plaintext password storage server-side).
- **`internal/smtp/server`** — TCP listener, EHLO/HELO/STARTTLS/AUTH/MAIL/RCPT/DATA state machine, two modes (`ModeMX` for port 25 with `LookupRecipient`, `ModeSubmission` for 587 with required AUTH).
- **`internal/smtp/client`** — outbound DialOpts, `Mail/Rcpt/Data/Quit`, `LookupMX` helper, transparent STARTTLS upgrade, classifies SMTP responses into `Permanent` / `Transient` for the worker's backoff.
- **`internal/dkim`** — RFC 6376 with `relaxed/relaxed` canonicalization, RSA-SHA256 + Ed25519, DNS TXT helper. Hooked into `mailworker` before `smtpclient.Send`.
- **`cmd/elvishdkim`** — `genkey` (RSA 2048+ or Ed25519) and `txt` (emit the DNS TXT record value).

`Backend` is a small interface (`HandleInbound`, `HandleSubmission`, `LookupRecipient`, `Authenticator`). `cmd/elvishserver/smtp_backend.go` adapts it to `mailpipe.IngestExternal` / `IngestSubmission` and to `store.UserByEmail` (bcrypt) for the AUTH check.

### Removed dependencies

```
github.com/emersion/go-smtp
github.com/emersion/go-sasl
```

(The previously vendored `net/smtp` consumer was the outbound client; now replaced by `internal/smtp/client`.)

### Tests

- `internal/smtp/wire/wire_test.go` — golden tests for command parsing, multi-line reply emission, dot-stuffing edge cases.
- `internal/smtp/server/server_test.go` — drives the server with the in-tree client over `httptest`-style net.Listener pairs; verifies MX rejection of unknown rcpt, submission AUTH gating, STARTTLS handshake.
- `internal/dkim/sign_test.go` — RSA + Ed25519 round-trip, body hash matches RFC 6376 fixture, `SignAndPrepend` produces a parseable header.
- `cmd/elvishmailtest no-plaintext-audit` ingests via the gateway path and asserts the sentinel never appears in any store.

### Rejected alternatives

- **Stay on `emersion/go-smtp`** — works today, but adds a moving dependency at the edge; we already had to fork-patch it for the per-IP rate limiter.
- **Use the standard library `net/smtp` for the client only** — its API is too rigid for STARTTLS opportunistic upgrades and SMTP error classification, and we need the same wire types on both sides.
- **Adopt Postfix as a sidecar** — operationally heavier; would still need a custom milter for gateway encryption.

## Consequences

- The SMTP edge is small and auditable.
- We control the wire format end-to-end; adding RFC 6531 SMTPUTF8 or future extensions is local.
- DKIM rotation is a single-signer hot-swap (`mailworker.Config.DKIMSigner` is a pointer; we can rebuild the worker with a new signer at runtime).
- Cost: we now own the bug surface for two SMTP implementations (server + client). Mitigation: the server's parser uses the conservative subset (single-line commands < 1024 bytes, no advanced ABNF features) and the client only sends what it generated itself.
