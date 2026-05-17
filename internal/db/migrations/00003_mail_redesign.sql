-- +goose Up
-- +goose StatementBegin

-- Destructive replacement of mail_messages and mail_outbox.
-- Mail bodies now live in object storage (encrypted). Mailbox indexes live in Scylla.
-- Cockroach keeps only relational identity, control, and durable state.

DROP INDEX IF EXISTS mail_messages_user_folder_created;
DROP INDEX IF EXISTS mail_outbox_pending_created;
DROP TABLE IF EXISTS mail_outbox;
DROP TABLE IF EXISTS mail_messages;

-- Skiff key hierarchy layer 1: KDF-wrapped account private key.
-- Server stores opaque blob only; KEK derivation happens client-side from the user's password.
CREATE TABLE user_account_keys (
    user_id        UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    fingerprint    TEXT NOT NULL,
    key_id_long    TEXT NOT NULL DEFAULT '',
    armored_public TEXT NOT NULL,
    wrapped_secret BYTEA NOT NULL,
    kdf            TEXT NOT NULL,
    kdf_salt       BYTEA NOT NULL,
    kdf_params     JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skiff key hierarchy layer 2: per-identity (per email) PGP keypair.
CREATE TABLE user_identity_keys (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email                  TEXT NOT NULL,
    fingerprint            TEXT NOT NULL,
    key_id_long            TEXT NOT NULL DEFAULT '',
    armored_public         TEXT NOT NULL,
    primary_uid            TEXT NOT NULL DEFAULT '',
    algorithm              TEXT NOT NULL DEFAULT '',
    bits                   INT NOT NULL DEFAULT 0,
    is_default             BOOL NOT NULL DEFAULT false,
    is_active              BOOL NOT NULL DEFAULT true,
    expires_at             TIMESTAMPTZ,
    revoked_at             TIMESTAMPTZ,
    revocation_certificate TEXT NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, fingerprint)
);

CREATE INDEX user_identity_keys_user_email ON user_identity_keys (user_id, email);

-- Wrapped identity private keys (PGP-encrypted to the account public key).
CREATE TABLE identity_secret_blobs (
    user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    fingerprint    TEXT NOT NULL,
    wrap_method    TEXT NOT NULL DEFAULT 'account-key',
    wrapped_secret BYTEA NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, fingerprint)
);

-- Per-user mail settings (privacy toggles).
CREATE TABLE user_mail_settings (
    user_id              UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    auto_encrypt_inbound BOOL NOT NULL DEFAULT true,
    wkd_publish          BOOL NOT NULL DEFAULT true,
    keyvault_idle_min    INT NOT NULL DEFAULT 15,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-field metadata consent (forward-only).
-- Field enum: subject, from_addr, to_addrs, date, thread_id, flags_summary, attachments_summary
CREATE TABLE mail_metadata_consent (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    field      TEXT NOT NULL,
    allowed    BOOL NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, field)
);

-- Mail domains owned/managed by users.
CREATE TABLE mail_domains (
    domain         TEXT PRIMARY KEY,
    owner_user_id  UUID REFERENCES users (id) ON DELETE SET NULL,
    dkim_selector  TEXT NOT NULL DEFAULT '',
    dkim_key_id    TEXT NOT NULL DEFAULT '',
    mx_target      TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mail aliases (email addresses → identity).
CREATE TABLE mail_aliases (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email                TEXT NOT NULL UNIQUE,
    identity_fingerprint TEXT NOT NULL DEFAULT '',
    is_default           BOOL NOT NULL DEFAULT false,
    is_active            BOOL NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mail_aliases_user ON mail_aliases (user_id);

-- Outbox state only; payload lives in object storage.
CREATE TABLE mail_outbox (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'pending',
    payload_blob_ref   TEXT NOT NULL,
    payload_size_bytes BIGINT NOT NULL DEFAULT 0,
    attempts           INT NOT NULL DEFAULT 0,
    next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_smtp_code     INT NOT NULL DEFAULT 0,
    last_error         TEXT NOT NULL DEFAULT '',
    recipient_summary  TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mail_outbox_lease ON mail_outbox (status, next_attempt_at);

CREATE TABLE mail_bounces (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id     UUID NOT NULL REFERENCES mail_outbox (id) ON DELETE CASCADE,
    recipient     TEXT NOT NULL,
    code          INT NOT NULL DEFAULT 0,
    enhanced_code TEXT NOT NULL DEFAULT '',
    reason        TEXT NOT NULL DEFAULT '',
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mail_bounces_outbox ON mail_bounces (outbox_id);

-- Audit ledger; one row per accepted ingest.
CREATE TABLE mail_ingest_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id    UUID NOT NULL,
    source        TEXT NOT NULL,
    provenance    TEXT NOT NULL,
    body_blob_ref TEXT NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mail_ingest_ledger_user ON mail_ingest_ledger (user_id, received_at DESC);
CREATE UNIQUE INDEX mail_ingest_ledger_msg ON mail_ingest_ledger (message_id);

-- Resolver cache (positive entries; negative entries kept in Valkey only).
CREATE TABLE contact_pgp_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL,
    fingerprint         TEXT NOT NULL,
    armored_public      TEXT NOT NULL,
    source              TEXT NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL,
    verified_uid_match  BOOL NOT NULL DEFAULT false,
    proton_kt_state     TEXT NOT NULL DEFAULT '',
    UNIQUE (email, fingerprint)
);

CREATE INDEX contact_pgp_keys_email ON contact_pgp_keys (email);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS contact_pgp_keys;
DROP TABLE IF EXISTS mail_ingest_ledger;
DROP TABLE IF EXISTS mail_bounces;
DROP TABLE IF EXISTS mail_outbox;
DROP TABLE IF EXISTS mail_aliases;
DROP TABLE IF EXISTS mail_domains;
DROP TABLE IF EXISTS mail_metadata_consent;
DROP TABLE IF EXISTS user_mail_settings;
DROP TABLE IF EXISTS identity_secret_blobs;
DROP TABLE IF EXISTS user_identity_keys;
DROP TABLE IF EXISTS user_account_keys;
-- +goose StatementEnd
