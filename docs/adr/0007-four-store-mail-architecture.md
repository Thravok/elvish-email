# ADR 0007 — Four-store mail architecture

**Status:** Accepted (2026-05)
**Related:** [0001 — CockroachDB primary database](./0001-primary-database-cockroach.md), [0004 — Per-field consent](./0004-per-field-metadata-consent.md), [0005 — Account key hierarchy](./0005-account-key-hierarchy.md), [0006 — Own SMTP stack](./0006-own-smtp-stack.md), [0008 — Local-only body search](./0008-local-only-body-search.md)

## Context

The original mail subsystem stored everything in CockroachDB: bodies as bytea blobs, outbox payloads as bytea, manifests as rows. That works at low volume but:

- Cockroach replicates body bytes 3× (one per replica) — wasteful for already-large PGP ciphertext.
- Per-message hot path (insert manifest + insert outbox row + insert ledger) is a multi-statement transaction; throughput tops out under load.
- Listing a mailbox folder requires scanning a partition by `received_at`; Cockroach is not built for that pattern.
- Object storage is a much better home for large opaque blobs; Scylla is a much better home for time-ordered mailbox rows.

## Decision

Split mail data across four stores by access pattern:

### CockroachDB — relational truth

Tables (migration `00003_mail_redesign.sql`):

- `user_account_keys` — Skiff layer-1 wrapped account secret + KDF parameters.
- `user_identity_keys` + `identity_secret_blobs` — Skiff layer-2 per-email keypairs and PGP-wrapped private blobs.
- `user_mail_settings` — `auto_encrypt_inbound`, `wkd_publish`, `keyvault_idle_min`.
- `mail_metadata_consent` — per-`(user, field)` opt-in (forward-only).
- `mail_domains` + `mail_aliases` — domains we accept inbound for; addresses that route to a user.
- `mail_outbox` — **state only** (status, attempts, next_attempt_at, payload_blob_ref, recipient_summary, last_smtp_code).
- `mail_bounces` — per-`(outbox_id, recipient)` bounce reports.
- `mail_ingest_ledger` — durable audit row for every accepted message (user_id, message_id, source, provenance, blob_ref, received_at).
- `contact_pgp_keys` — keyserver positive cache (24h default TTL).

### ScyllaDB — mailbox-scale time-ordered data

Keyspace `elvish_mail` (DDL in `internal/scyllastore/schema.cql`):

- `message_manifest_by_id` — manifest pointer by message_id (header_ciphertext + blob_ref + provenance).
- `messages_by_mailbox` — `((user_id, folder), received_at DESC)` for inbox listing.
- `message_flags_by_user` — read/starred/deleted/labels per message.
- `message_events_by_user` — append-only event log (TTL 90 days).
- `opt_in_metadata_by_user` — sparse plaintext projection of consented header fields.

### Object storage (S3-compatible / MinIO locally)

Canonical key layout (`internal/blobstore.MailBodyKey`, etc.):

```
mail/{user_id}/{message_id}/body.enc                       — PGP ciphertext (always)
mail/{user_id}/{message_id}/attachments/{attachment_id}.enc — PGP ciphertext (always)
outbox/{user_id}/{outbox_id}.enc                            — PGP ciphertext (always)
```

The blobstore is accessed via an in-tree AWS SigV4 signer (`internal/blobstore/sigv4.go`) — no SDK dependency.

### Valkey

Sessions, rate limits (per-IP and per-user), keyserver negative cache, SMTP per-IP throttle, worker coordination flags. Same role as before, no new tables.

## Compensating writes

`mailpipe.persist` writes blob → manifest → mailbox row → opt-in metadata → ledger row in that order. Any failure after the blob upload triggers a compensating delete chain: delete opt-in row, delete mailbox row + manifest, delete blob. The ledger row is the last write because it's our durable "yes this happened" audit record.

`mailworker` does the inverse for outbox: delete blob only after `MarkOutboxSent` succeeds (so a crash between blob delete and row update leaves a recoverable orphan rather than an undeliverable row).

## Configuration

Added env vars (see README env table):

```
SCYLLA_HOSTS=127.0.0.1:9042
SCYLLA_KEYSPACE=elvish_mail
SCYLLA_USERNAME=
SCYLLA_PASSWORD=
SCYLLA_LOCAL_DC=

BLOB_S3_ENDPOINT=http://127.0.0.1:8333
BLOB_S3_REGION=us-east-1
BLOB_S3_BUCKET=elvish-mail
BLOB_S3_ACCESS_KEY=elvish-dev
BLOB_S3_SECRET_KEY=elvish-dev-secret
BLOB_S3_FORCE_PATH_STYLE=true
```

Local development: `make db-up` brings all four services up via `docker-compose.yml`, applies the Scylla schema, and bootstraps the default MinIO bucket.

## Rejected alternatives

- **Single-store (Cockroach)**: replication cost, hot-path latency, mailbox listing pattern.
- **Cockroach + S3 only** (no Scylla): forces secondary indexes on a tableset that scales by user, defeating the partition story.
- **Cockroach + S3 + Postgres logical replicas for mailbox listings**: more moving parts, weaker write throughput than Scylla.

## Consequences

- Each store handles the workload it's built for.
- Schema evolution is per-store: changing flags is a Scylla DDL change, changing consent fields is a Cockroach migration.
- Operationally heavier: you now run four datastores in production. Mitigated by Docker Compose for dev and by the `db-health` and `test-mail-e2e` Makefile targets that exercise all four.
