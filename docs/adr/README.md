# Architecture decision records (ADRs)

Numbered decisions for ELVish mail, storage, and operational choices. When adding a new ADR, use the next sequential id, keep the `docs/adr/NNNN-short-title.md` naming pattern, and add a row to the table below.

| ADR | Title | Status | Intent (one line) |
|-----|-------|--------|---------------------|
| [0001](0001-primary-database-cockroach.md) | Primary durable store is CockroachDB/Postgres (SQL) | Accepted (historical) | Single relational system of record with goose migrations; Valkey for ephemeral data. |
| [0002](0002-mail-transport-go-smtp.md) | Mail transport only inside the Go binary | Superseded by 0006 | Single process owns HTTP and SMTP; originally used emersion/go-smtp and net/smtp. |
| [0003](0003-keyserver-resolution-chain.md) | Keyserver resolution chain | Accepted (2026-05) | Deterministic WKD → Proton → HKPS order with caching and safety properties for recipient keys. |
| [0004](0004-per-field-metadata-consent.md) | Per-field metadata consent | Accepted (2026-05) | Replace coarse mail modes with per-field consent for plaintext metadata in projections. |
| [0005](0005-account-key-hierarchy.md) | Skiff-style account/identity key hierarchy | Accepted (2026-05) | Password-derived KEK wraps account key; account key wraps per-identity PGP secrets (browser-only unwrap). |
| [0006](0006-own-smtp-stack.md) | Own SMTP stack | Accepted (2026-05) | In-tree SMTP wire/server/client and DKIM; supersedes 0002 dependency choices. |
| [0007](0007-four-store-mail-architecture.md) | Four-store mail architecture | Accepted (2026-05) | Split mail across Cockroach, Scylla, S3, and Valkey by access pattern and cost. |
| [0008](0008-local-only-body-search.md) | Local-only body search | Accepted (2026-05) | Full-text body search only in browser IndexedDB worker; no server body-search API. |
| [0009](0009-protected-link-mode.md) | Protected-link send mode (Mode B) | Accepted (2026-05) | Sender-chosen password wraps body client-side; server stores ciphertext only. |
| [0010](0010-plaintext-relay-mode.md) | Plaintext-relay send mode (Mode C) | Legacy / being removed from zero-access flows | Relay PGP key wraps plaintext for outbound send with no cleartext at rest; retained for scoped internal mail. |
| [0011](0011-anonymous-operational-telemetry.md) | Anonymous operational telemetry | Accepted (2026-05) | Opt-in, self-hosted, identifier-free hourly SQL rollups only. |
| [0012](0012-browser-mail-ui-strategy.md) | Browser mail UI delivery (compiled React vs Go shell) | Accepted (2026-05) | esbuild/React + vendors; lazy admin embed; **recorded off-React order: auth → thin TS → admin shell → mail last**; templ+vanilla+TS target. |
| [0013](0013-login-with-elvish-oidc-issuer.md) | “Login with Elvish” OIDC issuer (Tailscale + registered clients) | Accepted (2026-05) | Minimal RS256 issuer + WebFinger + Valkey codes; no inbound social OIDC; MFA gate when enabled. |
