# ADR 0009 — Protected-link send mode (Mode B)

**Status:** Accepted (2026-05)
**Related:** [0005 — Account key hierarchy](./0005-account-key-hierarchy.md), [0010 — Plaintext relay mode](./0010-plaintext-relay-mode.md), [0008 — Local-only body search](./0008-local-only-body-search.md)

## Context

PGP-direct send (Mode A) is wonderful when the recipient already has a published OpenPGP key. In practice, most non-Elvish recipients do not. The two common workarounds — sending plaintext mail or attaching an opaque PGP file with a side-channel passphrase — both regress UX and force the sender to leak the body to the operator's outbound mail flow.

We want a third option that:

1. Works for any recipient with a browser, no account, no PGP setup.
2. Stores **only** ciphertext on the server. The server cannot read the body.
3. Lets the sender choose the unlock secret out-of-band (Signal, in person, voice).
4. Has a finite lifetime (TTL) and an optional view counter (burn after N reads).
5. Survives server compromise of the at-rest store: an attacker with read access to Cockroach + object storage cannot recover the body.

## Decision

A new send mode where the **sender's browser** wraps the message body under a sender-chosen password, and the recipient unlocks it in-browser at a public URL `/m/{token}`. The server stores opaque blobs and never sees the password.

### Key flow

```
sender browser:
  msgKey  = randomBytes(32)
  payload = AES-256-GCM(msgKey, body) (nonce || ct || tag)
  salt    = randomBytes(16)
  kek     = pbkdf2-sha256-600k(password, salt) | argon2id(...)   // matches keygen.js
  wrapped = AES-256-GCM(kek, msgKey)               (nonce || ct || tag)

POST /api/v1/mail/protected-links {
  kdf, kdf_salt_b64, kdf_params_json,
  wrapped_msg_key_b64,
  body_ciphertext_b64,
  ttl_seconds, max_views,
  recipient_emails[], notify_recipients,
  subject_hint
}

server:
  token   = base64url(randomBytes(32))                // 43 chars
  blob    = secure-link/{token}.enc                   // body_ciphertext_b64
  row     = mail_protected_links                      // metadata + wrapped key
  IF notify_recipients AND ELVISH_RELAY_KEY_PATH set:
    submitPlaintextOutbox(notice email with /m/{token})

recipient browser at /m/{token}:
  GET  /api/v1/protected-links/{token}/meta            -> kdf, salt, expires, views_remaining
  POST /api/v1/protected-links/{token}/open            -> ConsumeView (atomic) + wrapped + ciphertext
  kek      = kdf(password_typed_locally, salt)
  msgKey   = AES-GCM-decrypt(kek, wrapped)
  body     = AES-GCM-decrypt(msgKey, ciphertext)
  render(body)
```

### View-counter atomicity

`UPDATE mail_protected_links SET views = views + 1, burned_at = CASE WHEN max_views > 0 AND views + 1 >= max_views THEN now() ELSE burned_at END WHERE token = $1 AND burned_at IS NULL AND expires_at > now() AND (max_views = 0 OR views < max_views) RETURNING ...`

A single `UPDATE ... RETURNING` performs the increment + burn-mark + read-back as one transaction so concurrent recipients can never collectively exceed `max_views`. `internal/maillinks/race_integration_test.go` spawns 20 concurrent ConsumeView calls against a `max_views=5` link and asserts exactly 5 succeed.

### Background sweeper

A 5-minute ticker (`cmd/elvishserver/protected_link_sweeper.go`) calls `links.PurgeExpired(100)` and deletes the matching ciphertext blobs. This bounds the worst-case retention window to TTL + sweep interval.

### Public endpoints

| Method | Path | Auth | Rate limit | Purpose |
|--------|------|------|------------|---------|
| `GET`  | `/m/{token}` | none | n/a | Static recipient HTML page |
| `GET`  | `/api/v1/protected-links/{token}/meta` | none | 60/hr/IP | Render unlock prompt + expiry |
| `POST` | `/api/v1/protected-links/{token}/open` | none | 12/hr/IP | Atomic ConsumeView + return wrapped key + ciphertext |
| `POST` | `/api/v1/mail/protected-links` | session | per-user mail limit | Sender create |

The 12/hr/IP open limit forces serial brute-force attacks against the password to be slow regardless of pool size.

## Threat model

| Adversary | Outcome |
|-----------|---------|
| Server operator (read DB + blobs) | Cannot decrypt: holds wrapped msg key + ciphertext only. Brute force is bounded by the sender-chosen password's entropy + KDF cost. |
| Active server attacker (modifies blob) | Recipient's AES-GCM tag check fails; decryption errors loudly. |
| Recipient inbox provider (sees notification email) | Sees the URL but not the password (sender shares OOB). URL alone is not enough to read the body. |
| Network observer | Same as recipient inbox provider. The link is HTTPS-protected in transit. |
| Lost password | Permanent loss of the body. Documented; no recovery path. |

The password is **never** sent to the server. CI enforces this with:

- `make lint` grep guard against `"password"` / `"kek_b64"` in `internal/httpserver/api_protected_links.go`, `internal/maillinks/`, and `internal/relaykey/`.
- Go test `TestProtectedLinkPasswordNeverServerSide` in `internal/httpserver/no_search_body_test.go` doing the same scan at build time.

## Consequences

- Senders get a one-tap path for E2E to non-PGP recipients.
- Operators must be aware that protected-link blobs eat object storage quota; the sweeper bounds retention to 30 days max (TTL clamp).
- Lost passwords mean lost messages by design. UI must surface this clearly at compose time.
- Relay-key requirement is soft: if the operator did not configure `ELVISH_RELAY_KEY_PATH`, the recipient notification email path is disabled but the protected link itself is still created — the sender just has to share the URL out-of-band themselves.
