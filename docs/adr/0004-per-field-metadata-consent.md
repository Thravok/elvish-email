# ADR 0004 — Per-field metadata consent (replaces strict/balanced)

**Status:** Accepted (2026-05)
**Replaces:** the original "strict vs balanced" mode flag in `user_mail_settings`
**Related:** [0003 — Keyserver chain](./0003-keyserver-resolution-chain.md), [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md)

## Context

Earlier drafts of Elvish mail offered the user a single `mail_mode` toggle: **strict** (everything encrypted, including subject and from-address) or **balanced** (server stores subject/from/date in plaintext for sorting and search). That was easy to implement but coarse:

- Users who only wanted subject visible had to also expose from/to.
- The threading column (Message-Id) is needed for conversation grouping but most users would not consent to leaking who they're talking to just to get threading.
- A binary flag couldn't express forward-only intent (toggle on does not mean "decrypt my history").

## Decision

Replace `mail_mode` with **`mail_metadata_consent`**: a per-`(user_id, field)` table in CockroachDB, where each row records whether the user has consented to a specific column being persisted as plaintext in `opt_in_metadata_by_user` (Scylla).

Allowed fields (`mailmeta.AllowedConsentFields`):

| Field | What server sees if consented |
|-------|-------------------------------|
| `subject` | Subject header, used for inbox sorting + server metadata search |
| `from_addr` | Sender RFC 5322 address |
| `to_addrs` | Recipient list |
| `date` | Original send date for chronological sort |
| `thread_id` | Message-Id, for conversation grouping |
| `flags_summary` | Read/starred/labels summary |
| `attachments_summary` | Number + total size of attachments |

### Forward-only

Toggling a field **on** starts persisting that field for **new** messages (in `mailpipe.persist`). Past messages keep only their `header_ciphertext` blob (PGP ciphertext addressed to the recipient identity); the browser can still decrypt them via `KeyVault`, so the UX cost is bounded to "past messages decrypt client-side instead of being sortable server-side". Toggling a field **off** stops the next persist; existing rows in `opt_in_metadata_by_user` are left in place (the user can manually clear them with `DELETE … WHERE user_id = ?` in a future tool, but we intentionally do not auto-purge to avoid a hidden "I can't see my old subjects" footgun).

### Validation

- The `/api/v1/mail/settings` POST handler rejects unknown field names with `400`.
- The `/api/v1/mail/search/metadata` endpoint rejects any `fields=` entry the user has not consented to with `400 unconsented_field`.
- The frontend renders each toggle with a tooltip stating "Forward-only — toggling on starts persisting from now."

### Rejected alternatives

- **Single `mail_mode` flag** — too coarse (see Context).
- **Field-level encryption** (encrypt each header field separately to allow selective server access without full ciphertext readback) — adds significant key-management complexity for marginal benefit; we already have a per-message `header_ciphertext` that the client can decrypt.
- **Retroactive backfill** when consent toggles on — would require per-message decryption with the user's identity key on the server, which violates the "server never holds plaintext keys" invariant.

## Consequences

- The user's privacy posture is fine-grained and self-explanatory in Settings → Mail.
- The `opt_in_metadata_by_user` table in Scylla is **sparse**: each row only contains the columns the user has consented to.
- Server-side metadata search (`/api/v1/mail/search/metadata`) is gated per field, so leaking the search term itself only reveals fields the user already consented to.
- The "no plaintext at rest" invariant test in `internal/mailpipe/no_plaintext_test.go` runs with consent OFF, so a regression that bypasses the gate would fail CI.
