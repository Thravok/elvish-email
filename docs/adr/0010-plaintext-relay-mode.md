# ADR 0010 — Plaintext-relay send mode (Mode C)

**Status:** Legacy / being removed from zero-access user flows (2026-05)
**Related:** [0009 — Protected-link send mode](./0009-protected-link-mode.md), [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md), [0006 — Own SMTP stack](./0006-own-smtp-stack.md)

> User-authored plaintext relay is no longer part of the zero-access browser mail
> surface. This ADR is retained only to document the legacy relay-key design
> that may still be used for tightly-scoped internal notification mail.

## Context

Modes A (PGP-direct) and B (protected-link) both keep the server out of the trust boundary for *body* contents. There is still a real demand for plain old non-encrypted email — newsletter replies, automated notifications, "send me my own thing in plaintext", etc.

A naive implementation accepts the cleartext body, persists it to the outbox, and lets the worker dispatch it. That regresses the **"no plaintext at rest"** invariant the rest of the design enforces:

- A snapshot of CockroachDB or object storage would expose the message verbatim.
- Outbox payloads are retried for transient errors and may sit on disk for hours.
- Backups inherit the exposure.

We want plaintext to be a real first-class send mode without weakening at-rest guarantees.

## Decision

The server holds a long-lived **server relay key** (an OpenPGP keypair) loaded at startup from `ELVISH_RELAY_KEY_PATH`. When a sender chooses Mode C:

1. The HTTP layer wraps the cleartext MIME message with the relay public key (PGP-encrypt) **before** any persistence.
2. The opaque ciphertext is uploaded to object storage; only its blob ref + minimal envelope (recipients, queued status) lives in CockroachDB.
3. The mail worker leases the row, fetches the ciphertext, **decrypts in process memory** with the relay private key, signs it with DKIM, dispatches over SMTP, and **wipes the plaintext buffer** (`wipeBytes`) before continuing.
4. The on-disk outbox row is marked with `kind = 'plaintext_relay'` so the worker knows it must unwrap before send.

### Code shape

```
client (compose.jsx, sendPlaintext) ──POST /api/v1/mail/outbox-plain──┐
                                                                       │
internal/httpserver/api_outbox_plain.go:                              │
  buildRFC5322(headers + body)                                        │
  ciphertext = relayKey.Wrap(rfc5322Bytes)        // PGP-encrypt      │
  blobstore.Put("outbox/{userID}/{outboxID}.enc", ciphertext)         │
  mailmeta.InsertOutboxKind(..., kind="plaintext_relay")              │
                                                                       ▼
mailworker.deliver(row):
  case row.Kind == "plaintext_relay":
    cipher  := blobstore.Get(row.BlobRef)
    plain   := relayKey.Unwrap(cipher)             // in-memory only
    signed  := dkim.Sign(plain)
    smtp.Send(signed)
    defer wipeBytes(plain)
    defer wipeBytes(signed)
```

### Why a separate keypair (not the operator's DKIM key)

DKIM keys are *signing-only* in our codebase (`dkim.NewRSASignerFromPEM` exposes no decrypt). The relay key is *encryption-only* from the worker's perspective: it has no DKIM presence in DNS and is never used for signing outbound mail. Separation keeps each key's blast radius small.

### Generation + rotation

`cmd/elvishrelay` mints an EdDSA/RSA OpenPGP keypair, prints the fingerprint, and writes the armored private key to disk. Rotation is currently manual:

1. Generate a new keypair: `elvishrelay generate --out /etc/elvish/relay-new.asc`
2. Drain the outbox to empty (or accept that any in-flight `plaintext_relay` rows minted before the swap will fail to unwrap).
3. Replace the file and restart elvishserver.

The `mail_outbox.kind` column is forward-compatible with a future `kind = 'plaintext_relay_v2'` value if we want zero-downtime rotation later (worker can branch by minor version).

## Threat model

| Adversary | Outcome |
|-----------|---------|
| Read-only DB/blob compromise | Sees only PGP ciphertext + outbox metadata. Cannot recover bodies without the relay private key. |
| Read of running worker memory | Plaintext is recoverable for the milliseconds between `Unwrap` and `wipeBytes`. This is the residual risk we accept; it's strictly smaller than "plaintext at rest". |
| Stolen relay private key alone | Decrypts ciphertext blobs that haven't been swept yet. Mitigation: outbox rows are deleted on success; expired/failed rows are GC'd by the worker. |
| Stolen relay key + DB read | Equivalent to "we sent plaintext mail" — the design's worst case is no worse than non-Elvish plain SMTP. |
| Sender claims "I never sent that" | DKIM signature on the dispatched message proves origin domain; the outbox row + audit log proves account. |

The relay key is loaded at process boot and held in process memory. We do not persist it through Cockroach or any backup. Operators are expected to provision it via secret manager → file mount, same pattern as DKIM keys.

## Consequences

- Plaintext send is real but is **not** an "encryption-free" mode internally — it's "encrypt at rest under a server-held key, decrypt only in flight".
- Operators must provision a relay key (`elvishrelay generate`) at deploy time; the absence of one cleanly disables Mode C in the UI rather than failing at send time.
- The protected-link notification email path (Mode B) reuses this same plumbing: the recipient notice is built as a plaintext message and routed through `submitPlaintextOutbox`, so the same relay key gates both modes.
- DKIM still applies. The worker signs after `Unwrap` so the outgoing wire format is identical to a Mode A dispatch.
- No new test infrastructure is required beyond the round-trip `Wrap/Unwrap` test in `internal/relaykey/keypair_test.go` and the existing outbox lease/dispatch integration tests.
