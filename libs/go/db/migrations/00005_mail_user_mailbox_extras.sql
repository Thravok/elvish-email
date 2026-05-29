-- +goose Up
-- +goose StatementBegin

-- Custom mailbox folders (names only; message rows live in Scylla under same folder string).
CREATE TABLE mail_user_folders (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, name)
);

CREATE INDEX mail_user_folders_user ON mail_user_folders (user_id);

-- Server-side filter rules (storage only; delivery-time evaluation is separate).
CREATE TABLE mail_user_filters (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filter_id  UUID NOT NULL DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    enabled    BOOL NOT NULL DEFAULT true,
    priority   INT NOT NULL DEFAULT 0,
    conditions JSONB NOT NULL DEFAULT '[]',
    actions    JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, filter_id)
);

CREATE INDEX mail_user_filters_user_priority ON mail_user_filters (user_id, priority DESC);

-- SMTP submission credentials (password hashed for SASL; plaintext shown once at creation).
CREATE TABLE user_smtp_credentials (
    user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    credential_id       UUID NOT NULL DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    identity_fingerprint TEXT NOT NULL DEFAULT '',
    username            TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, credential_id)
);

CREATE INDEX user_smtp_credentials_username ON user_smtp_credentials (username);

ALTER TABLE mail_domains
    ADD COLUMN IF NOT EXISTS mx_verified BOOL NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS spf_verified BOOL NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS dkim_verified BOOL NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS dmarc_verified BOOL NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_txt_host TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS verification_txt_value TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS catchall_identity_fp TEXT NOT NULL DEFAULT '';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE mail_domains
    DROP COLUMN IF EXISTS catchall_identity_fp,
    DROP COLUMN IF EXISTS verification_txt_value,
    DROP COLUMN IF EXISTS verification_txt_host,
    DROP COLUMN IF EXISTS dmarc_verified,
    DROP COLUMN IF EXISTS dkim_verified,
    DROP COLUMN IF EXISTS spf_verified,
    DROP COLUMN IF EXISTS mx_verified;

DROP TABLE IF EXISTS user_smtp_credentials;
DROP TABLE IF EXISTS mail_user_filters;
DROP TABLE IF EXISTS mail_user_folders;
-- +goose StatementEnd
