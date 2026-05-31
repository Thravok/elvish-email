# ADR 0017 — Full server metadata for inbound mail

**Status:** Accepted (2026-05)
**Supersedes:** [0004 — Per-field metadata consent](./0004-per-field-metadata-consent.md) (partially)
**Related:** [docs/e2ee-mail-spec.md](../e2ee-mail-spec.md), [0007 — Four-store architecture](./0007-four-store-mail-architecture.md)

## Context

ADR 0004 introduced forward-only per-field consent toggles so users could choose which header fields the server persisted in `opt_in_metadata_by_user`. The product simplified Settings → Mail: per-field toggles were removed and the server always writes subject/from/to/date/thread metadata when headers are available at ingest (SMTP gateway paths and external mail).

Client-authored mail (browser compose) still stores an empty header summary at ingest; listing relies on decrypting `header_ciphertext` client-side, preserving E2EE for outbound mail metadata.

## Decision

1. **Server metadata policy:** When ingest parses RFC822 headers (inbound SMTP, gateway-encrypt paths), persist the full standard metadata projection in Scylla (`opt_in_metadata_by_user`) without per-field consent gating.
2. **API:** `GetConsent()` returns full consent; `SetConsent()` is a no-op. Settings endpoints do not expose consent toggles.
3. **Search:** `/api/v1/mail/search/metadata` searches all standard metadata columns; field names remain validated against `AllowedConsentFields` for API stability.
4. **Threat model:** Users accept that header metadata for **inbound SMTP mail** is visible to the operator in Scylla (same as traditional mail providers). Message **bodies** remain ciphertext at rest; the no-plaintext invariant is unchanged.

## Consequences

- ADR 0004 forward-only consent UX is retired; document history remains for rationale.
- Privacy-focused users should prefer client-to-client mail (Mode A compose) where headers are encrypted in `header_ciphertext` only.
- CI no-plaintext tests still run with default consent; metadata rows may contain header fields for SMTP fixtures.

## References

- `internal/mailmeta/settings.go` — `FullConsent()` implementation
- `internal/mailpipe/pipe.go` — `persist()` metadata write
