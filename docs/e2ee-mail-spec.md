# Elvish E2EE mail — product spec and threat model

This document is the **source of truth** for the Elvish encrypted mail subsystem. It captures what is shipped, the threat model, and the data flow across the four-store architecture (Cockroach + Scylla + S3-compatible blob store + Valkey).

> **Where to start reading:** the per-area ADRs in `docs/adr/0003`–`0008` capture the rationale for each design decision. This spec stitches them into one product-shaped document.

## 1. Architecture

| Store | Role | Code |
|-------|------|------|
| **CockroachDB** | Identity (`user_account_keys`, `user_identity_keys`, `identity_secret_blobs`), global keyserver positive cache (`contact_pgp_keys`), **per-user trusted contact keys** (`mail_user_contact_keys`), control (`mail_metadata_consent`, `user_mail_settings`, `mail_domains`, `mail_aliases`), durable state (`mail_outbox`, `mail_bounces`, `mail_ingest_ledger`) | `internal/mailmeta` + `internal/db/migrations/` |
| **ScyllaDB** (`elvish_mail`) | `message_manifest_by_id`, `messages_by_mailbox`, `message_flags_by_user`, `message_events_by_user` (TTL 90d), `opt_in_metadata_by_user` (sparse, only consented fields) | `internal/scyllastore` + `internal/scyllastore/schema.cql` |
| **Object storage (S3-compatible / MinIO locally)** | `mail/{user_id}/{message_id}/body.enc`, `mail/{user_id}/{message_id}/attachments/{attachment_id}.enc`, `outbox/{user_id}/{outbox_id}.enc` — all PGP ciphertext | `internal/blobstore` |
| **Valkey** | Sessions, rate limits, keyserver negative cache, SMTP per-IP throttle, worker coordination | `internal/session`, `internal/ratelimit`, `internal/keyserver/cache.go` |

Drivers/libraries we **own in-tree** (no third-party dep): `internal/smtp/{wire,sasl,server,client}` (RFC 5321), `internal/dkim/` (RFC 6376), `internal/blobstore/sigv4.go` (AWS SigV4 PUT/GET/HEAD/DELETE).

## 2. Threat model

- The server **never** holds plaintext private keys at any layer. KDF-wrapped account secret + wrapped identity secrets are the only user key material persisted.
- **Internal/client-authored mail** (web UI → `POST /api/v1/mail/messages`) is true zero-access: the browser OpenPGP-signs and encrypts before upload. The server only stores ciphertext.
- **External SMTP inbound** (`mailpipe.IngestExternal`): if the body is already OpenPGP-wrapped (`already_encrypted` / sender PGP-MIME provenance), it is stored as-is. Otherwise the server **gateway-encrypts** the RFC822 payload to the resolved recipient identity’s **public** key before persistence (`smtp_gateway_encrypted` provenance). Cleartext is not stored at rest, but the ingest path may see plaintext transiently—the same residual class as any encrypt-on-receipt gateway. (See `internal/mailpipe/pipe.go` and `cmd/elvishserver/smtp_backend.go`.)
- **Per-field consent** (`mail_metadata_consent`) is **forward-only**: toggling subject ON applies only to mail received afterward; past messages stay readable via `header_ciphertext` decrypt in the browser (ADR 0004).
- **Body content is never indexable on the server**, irrespective of consent settings. There is no `/api/v1/mail/search/body` endpoint, ever. Body search is exclusively a client-side, IndexedDB-backed, AES-GCM-encrypted index built per identity from decrypted message bodies (ADR 0008). CI enforces this with `make lint` (`! grep search/body internal/httpserver/`) and a Go test in `internal/httpserver/no_search_body_test.go`.
- **THE invariant**: after `mailpipe.Ingest*` returns, the original cleartext bytes are absent from every Cockroach row, every Scylla row, every blobstore value/key, every log line, and every API response. Validated by `internal/mailpipe/no_plaintext_test.go` and `elvishmailtest no-plaintext-audit`.

## 3. Key flows

### 3.1 Inbound external (PGP as-is or gateway-encrypt)

```
ext MX → smtp/server (port 25) → mailpipe.IngestExternal
                                       ↓
            recipient_identity := mailmeta.IdentityForEmail(rcpt)
            kind := openpgp.Sniff(body)
            switch kind {
              case ArmoredMessage|BinaryPGP|PGPMIME:
                               ciphertext = body
                               provenance = already_encrypted (or sender PGP-MIME)
              default:
                               ciphertext = openpgp.Encrypt(recipient_pubkey, rawBody)
                               provenance = smtp_gateway_encrypted
            }
            blob.Put(mail/{uid}/{mid}/body.enc, ciphertext)
            scylla.InsertManifest(... header_ciphertext = openpgp.Encrypt(recipient_pubkey, headerJSON))
            mailmeta.IngestLedger.Append(...)
            wipe(rawBody)
```

### 3.2 Internal client-authored

```
browser → openpgp.Encrypt(recipient_pubkey, body) and openpgp.Encrypt(recipient_pubkey, headerJSON)
       → POST /api/v1/mail/messages {recipient, header_ciphertext_b64, body_ciphertext_b64, ...}
       → mailpipe.IngestInternal (refuses cleartext bodies via openpgp.Sniff guard)
       → blob.Put + scylla.InsertManifest + ledger
```

### 3.3 Outbound

```
browser → openpgp.Encrypt(payload, recipient_pubkeys[])
       → POST /api/v1/mail/outbox {payload_ciphertext_b64, recipient_summary[]}
       → blobstore.Put(outbox/{uid}/{oid}.enc) + mailmeta.InsertOutbox(state row)
mailworker → meta.RecoverStuckSending() → meta.LeasePendingOutbox()
          → blob.Get(payload) → optional dkim.SignAndPrepend
          → smtp/client.LookupMX(domain) → Mail/Rcpt/Data
          → on 2xx: meta.MarkOutboxSent + scylla.AppendEvent(kind=sent)
          → on 5xx: meta.InsertBounce + meta.MarkOutboxFailed(transient=false)
          → on 4xx/dial err: meta.MarkOutboxFailed(transient=true) (exponential backoff with jitter)
```

### 3.4 Account + identity bootstrap

```
/register → keygen.js
            salt        := random(16)
            kek         := argon2id(password, salt) || pbkdf2-sha256(password, salt, 600000)
            accountKey  := openpgp.generateKey({type:'ecc', curve:'curve25519'})
            wrappedAcct := AES-256-GCM(kek, accountKey.private)
            identities  := [...] each: openpgp.encrypt(identity.private, accountKey.public)
         → POST /api/v1/account-key/bootstrap { armored_public, wrapped_secret_b64, kdf, kdf_salt_b64, kdf_params_json, identities }

/login   → unlock.js
            POST /api/auth/login/begin + /api/auth/login/finish (SRP)
            GET /api/v1/account-key/me → wrapped account secret + KDF params
            kek := re-derive(password, salt, kdf_params)
            account.private := AES-256-GCM-Open(kek, wrapped)
            GET /api/v1/identities → wrapped identity blobs
            for each: openpgp.decrypt(blob, account.private) → identity.private (in KeyVault)
```

### 3.4.1 Streamlined unlock + auto-bootstrap on `/mail`

The mail UI never sends the user back to `/register` to fix a missing key. The
`ElvishMailUnlockModal` (`static/mail/unlock-modal.jsx`) is the single entrypoint
for all key state:

```
on /mail load:
  if ElvishKeyVault.isUnlocked() → show inbox
  else                          → open ElvishMailUnlockModal

ElvishMailUnlockModal submit(password):
  GET /api/v1/account-key/me
  if !bootstrapped:
    keys := ElvishKeygen.bootstrap(user.email, password)        // generates account + 1 identity
    POST /api/v1/account-key/bootstrap (account + identity together)
    GET  /api/v1/account-key/me                                // re-fetch canonical wrap
  ElvishKeyVault.unlockAccount(me, password)                    // KEK derive + AES-GCM unwrap

  GET /api/v1/identities
  if list.length == 0:
    idKp := openpgp.generateKey({ecc curve25519})
    wrap := ElvishKeygen.pgpWrapToAccount(idKp.privateKey, me.armored_public)
    POST /api/v1/identities { wrapped_secret_b64: base64(armored), is_default: true }
    GET  /api/v1/identities

  for id in list: ElvishKeyVault.unlockIdentity(id)
```

Key generation order is always **account first, identity second**, so identity
private keys can be PGP-wrapped to the account public key as soon as they're
born. The same modal serves three states: (a) ordinary unlock, (b) account
missing → generate account + identity together, (c) account present but no
identities → mint a single default identity for the user's primary email.

### 3.4.2 Custom domain sharing (admin)

Operators can configure `mail_domains.share_mode` per domain: **`owner_only`** (default), **`all_verified_users`** (any signed-in user may add mailbox identities once the domain is `active` with MX verified), or **`allowlist`** (same bar, but only users listed in `mail_domain_allowlist`). DNS verification, DKIM ownership, and outbound signing remain tied to the domain row's `owner_user_id`; sharing only widens who may pick addresses when creating identities.

**Catch-all inbound:** unqualified recipient resolution for a custom domain still follows the owner's catch-all identity fingerprint on the `mail_domains` row. Shared users do not get per-user catch-all through that path unless a future phase adds explicit routing rules.

User API: `GET /api/v1/mail/usable-domains` returns owned verified domains plus shared domains the session user may use. Admin: `PATCH /api/admin/domains/{domain}/sharing` with `share_mode` and optional `allowlist_user_ids`.

### 3.5 Send modes

Two user-facing send modes are exposed at compose time. Both preserve the at-rest
invariant from §2; only the path to wire-format differs.

| Mode | Recipient requirement | At-rest payload | Worker behaviour |
|------|-----------------------|-----------------|------------------|
| **A — OpenPGP interop** | Recipient has a published OpenPGP key (resolver-fetched or pasted by sender) | OpenPGP ciphertext to recipient pubkey | Ship as-is |
| **B — Protected link** | Any email address; recipient gets a notification with `/m/{token}` URL and unlocks in-browser with a sender-shared password | Body = AES-GCM(msgKey); msgKey = AES-GCM(KEK, msgKey); KEK = Argon2id(password, salt) | Sweeper deletes expired/burned blobs |

**Expiring Elvish delivery:** when Mode A targets another local identity (`POST /api/v1/mail/messages`), senders may attach optional `expires_in_seconds` (≤ 30d) and/or `max_reads` (burn-after-N-opens). Policy is stored on `mail_message_lifecycle`; blob GET consumes a read atomically; the retention sweeper purges expired rows. Protected links (Mode B) use the same TTL/read-cap model via `mail_protected_links`.

Implementation pointers: `static/mail/compose.jsx` (UI), `internal/httpserver/api_protected_links.go` (Mode B), `internal/maillinks/` (Mode B store + sweeper hooks), `internal/httpserver/api_mail.go` + `internal/httpserver/api_keys.go` (Mode A), and `internal/mailworker/worker.go` (interop dispatch). ADR 0010 is now legacy-only.

## 4. HTTP API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login/begin` | public, rate-limited | SRP challenge start for browser login |
| POST | `/api/auth/login/finish` | public, rate-limited | SRP proof verification + session issue |
| POST | `/api/auth/password/begin` | session | SRP challenge start for password change |
| POST | `/api/auth/password/finish` | session | SRP proof verification + verifier/account-key update |
| POST | `/api/auth/account-delete/begin` | session | SRP challenge start for account delete |
| POST | `/api/auth/account-delete/finish` | session | SRP proof verification + account deletion |
| POST | `/api/v1/account-key/bootstrap` | session | Upload Skiff layer-1+layer-2 key material (one-time) |
| GET | `/api/v1/account-key/me` | session | Wrapped account secret + KDF params |
| GET | `/api/v1/identities` | session | List identities + wrapped private blobs |
| POST | `/api/v1/identities` | session | Add new identity (wrapped to account pubkey) |
| GET | `/api/v1/mail/usable-domains` | session | Domains the user may use for new mailbox identities (owned + shared per `mail_domains.share_mode`; requires mail subsystem) |
| POST | `/api/v1/identities/{fp}/default` | session | Mark default |
| POST | `/api/v1/identities/{fp}/revoke` | session | Submit revocation cert + mark inactive |
| DELETE | `/api/v1/identities/{fp}` | session | Hard delete identity + secret blob |
| GET | `/api/v1/keys/lookup?email=` | session, rate-limited (120/hr/user) | Run resolver chain (local → cache → WKD → Proton/HKPS) |
| GET | `/api/v1/mail/messages?folder=&limit=&before=` | session | Manifest list with `header_ciphertext_b64` + sparse consented fields |
| GET | `/api/v1/mail/messages/{id}` | session | Single manifest |
| GET | `/api/v1/mail/messages/{id}/blob` | session | Stream PGP body ciphertext |
| POST | `/api/v1/mail/messages` | session | Internal-route ingest of pre-encrypted body; optional `expires_in_seconds`, `max_reads` for expiring delivery |
| GET | `/api/v1/mail/settings` | session | Settings + per-field consent |
| POST | `/api/v1/mail/settings` | session | Update settings + consent (forward-only) |
| POST | `/api/v1/mail/test/echo` | session | Self-deliver a ciphertext (selfcheck) |
| POST | `/api/v1/mail/outbox` | session | Queue PGP ciphertext for outbound delivery (Mode A) |
| POST | `/api/v1/mail/outbox-plain` | session | Disabled for user-authored mail (`410 Gone`) |
| GET | `/api/v1/mail/outbox/{id}` | session | Status + bounces |
| POST | `/api/v1/mail/protected-links` | session | Create a protected-link blob + metadata (Mode B) |
| GET  | `/api/v1/protected-links/{token}/meta` | public, rate-limited | KDF params + view counter for `/m/{token}` page |
| POST | `/api/v1/protected-links/{token}/open` | public, rate-limited | Atomic ConsumeView + return wrapped key + ciphertext |
| GET  | `/m/{token}` | public | Static recipient HTML page (`static/protected/index.html`) |
| GET  | `/api/v1/keys/contacts` | session | List this user's saved contact keys (`trusted`, `trusted_at`, `source`, …). Optional `?trusted=1` filters to trusted rows only |
| GET  | `/api/v1/keys/contacts/{email}` | session | Preferred row for one address (latest trusted, else latest updated) |
| POST | `/api/v1/keys/contacts` | session | Upsert contact key; body may include `trusted` (default `true`). Persists to `mail_user_contact_keys` (per-user), not the global resolver cache |
| DELETE | `/api/v1/keys/contacts/{email}` | session | Remove all keys for `{email}` for this user, or `?fingerprint=` to delete one fingerprint |
| GET | `/api/v1/mail/search/metadata?q=&fields=` | session | Server-side search over consented columns only |
| PATCH | `/api/admin/domains/{domain}/sharing` | admin session | Set `share_mode` (`owner_only` / `all_verified_users` / `allowlist`) and optional `allowlist_user_ids` |
| GET | `/.well-known/openpgpkey/policy` | public | WKD discovery (empty body) |
| GET | `/.well-known/openpgpkey/hu/{hash}` | public | WKD direct (gated by `wkd_publish`) |
| GET | `/.well-known/openpgpkey/{domain}/hu/{hash}` | public | WKD advanced (gated by `wkd_publish`) |

**There is intentionally no `/api/v1/mail/search/body` route.** Body search is local-only (ADR 0008).

## 5. Configuration

See README env table for the canonical list. New blocks:

```bash
# ScyllaDB
SCYLLA_HOSTS=127.0.0.1:9042
SCYLLA_KEYSPACE=elvish_mail
SCYLLA_USERNAME=
SCYLLA_PASSWORD=
SCYLLA_LOCAL_DC=

# Object storage (S3-compatible)
BLOB_S3_ENDPOINT=http://127.0.0.1:8333
BLOB_S3_REGION=us-east-1
BLOB_S3_BUCKET=elvish-mail
BLOB_S3_ACCESS_KEY=elvish-dev
BLOB_S3_SECRET_KEY=elvish-dev-secret
BLOB_S3_FORCE_PATH_STYLE=true

# SMTP
ELVISH_MAIL_DOMAIN=elvish.email
ELVISH_HOSTNAME=mx.elvish.email
ELVISH_SMTP_ADDR=:25
ELVISH_SMTP_SUBMISSION_ADDR=:587
ELVISH_SMTP_ALLOW_PLAIN_AUTH=false   # only enable if a TLS terminator handles AUTH
ELVISH_SMTP_RATE_LIMIT_PER_HOUR=100    # per connecting IP on inbound MX + submission (Valkey; 451 when exceeded)

# DKIM (optional; outbound SMTP mail is domain-signed if all three are set)
# Selector/domain are normalized to lowercase at runtime before status checks and worker delivery.
ELVISH_DKIM_DOMAIN=elvish.email
ELVISH_DKIM_SELECTOR=mail
ELVISH_DKIM_KEY_PATH=/var/lib/elvish/dkim.pem

# Plaintext-relay key (legacy internal notifications only).
# User-authored plaintext relay is disabled in the browser mail surface.
ELVISH_RELAY_KEY_PATH=/var/lib/elvish/relay.asc

# Public base URL used when minting `/m/{token}` URLs into recipient notices.
ELVISH_PUBLIC_BASE_URL=https://elvish.email
```

## 6. Validation

- **CI**: `make test` runs the no-plaintext invariant, the consent gate test, the body-search-route guard, and the SMTP/DKIM round-trip suites.
- **`make lint`**: includes a grep guard that fails if `internal/httpserver/` mentions `search/body`.
- **`make test-mail-e2e`**: brings up Cockroach + Valkey + Scylla + MinIO, applies the Scylla schema, bootstraps the blob bucket, and runs `elvishmailtest no-plaintext-audit + bootstrap-and-selfcheck`.
- **Playwright (`e2e/tests/search.spec.ts`)**: asserts the server returns 404 on `/api/v1/mail/search/body` and that anonymous metadata search returns 401/503 (no leakage).
- **`elvishmailtest`** subcommands: `bootstrap-and-selfcheck`, `send-test`, `keyserver-probe`, `wrap-roundtrip`, `no-plaintext-audit`, `search-bench` (Playwright placeholder).

## 7. ADRs

| ADR | Topic |
|-----|-------|
| 0001 | CockroachDB primary database |
| 0002 | (superseded by 0006) Mail transport via go-smtp |
| 0003 | Keyserver resolution chain |
| 0004 | Per-field metadata consent (replaces strict/balanced) |
| 0005 | Skiff-style account/identity key hierarchy |
| 0006 | Own SMTP stack (supersedes 0002) |
| 0007 | Four-store mail architecture |
| 0008 | Local-only body search |
| 0009 | Protected-link send mode (Mode B) |
| 0010 | Plaintext-relay send mode (Mode C) |
