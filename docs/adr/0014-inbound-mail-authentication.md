# ADR 0014 — Inbound mail authentication (SPF, DKIM, DMARC)

**Status:** Proposed (Phase 2)
**Related:** [0006 — Own SMTP stack](./0006-own-smtp-stack.md), [docs/e2ee-mail-spec.md](../e2ee-mail-spec.md)

## Context

Inbound SMTP (port 25) currently accepts messages from any external sender when the recipient mailbox exists. The server gateway-encrypts plaintext before persistence, but users may still receive spoofed `From` addresses in encrypted header metadata after client decrypt.

Outbound deliverability tooling (DKIM signing, DNS TXT checks for custom domains) lives in `internal/dkim/` and `internal/httpserver/mail_delivery_checks.go`. **Inbound authentication verification is not implemented.**

## Decision (planned)

Add optional inbound authentication at `cmd/elvishserver/smtp_backend.go` **before** `mailpipe.IngestExternal`:

1. **SPF** — evaluate the connecting IP against the envelope/`From` domain SPF record.
2. **DKIM** — verify signatures on the received RFC822 message.
3. **DMARC** — evaluate `_dmarc.{domain}` policy against SPF/DKIM alignment.

Store compact `auth_results` on the message manifest (envelope + header fields only; no body scanning). Expose results in the mail UI for phishing indicators.

Operator-configurable failure modes:

| Mode | Behaviour |
|------|-----------|
| `none` | Log + store results only (default during rollout) |
| `quarantine` | Ingest to spam folder when policy fails |
| `reject` | SMTP 550 when policy fails |

## Consequences

- DNS lookups at SMTP DATA time add latency and failure modes; needs timeouts and caching.
- Strict reject mode may drop legitimate mail from misconfigured senders; must be opt-in.
- Does not replace client-side signature verification for OpenPGP payloads (`already_encrypted` provenance).

## Out of scope

- S/MIME inbound verification.
- Replacing the gateway-encrypt window for plaintext SMTP (architectural; see spec §2).

## Implementation notes (when accepted)

- New package: `internal/mailauth/` (SPF/DKIM/DMARC parsers + DNS).
- Env: `ELVISH_INBOUND_AUTH_MODE=none|quarantine|reject`.
- Tests: golden vectors for SPF/DKIM/DMARC; integration test with mock DNS.
