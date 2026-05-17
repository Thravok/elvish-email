-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_mfa_settings (
    user_id            UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    enabled            BOOL NOT NULL DEFAULT false,
    preferred_method   TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_totp_factors (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label              TEXT NOT NULL DEFAULT '',
    secret_encrypted   BYTEA NOT NULL,
    secret_version     INT NOT NULL DEFAULT 1,
    issuer             TEXT NOT NULL DEFAULT '',
    account_name       TEXT NOT NULL DEFAULT '',
    algorithm          TEXT NOT NULL DEFAULT 'SHA1',
    digits             INT NOT NULL DEFAULT 6,
    period_seconds     INT NOT NULL DEFAULT 30,
    verified_at        TIMESTAMPTZ,
    last_used_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at         TIMESTAMPTZ
);

CREATE INDEX user_totp_factors_user_idx
    ON user_totp_factors (user_id, created_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE user_webauthn_credentials (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label              TEXT NOT NULL DEFAULT '',
    credential_id      BYTEA NOT NULL,
    credential_json    JSONB NOT NULL DEFAULT '{}',
    aaguid             TEXT NOT NULL DEFAULT '',
    sign_count         BIGINT NOT NULL DEFAULT 0,
    transports         TEXT[] NOT NULL DEFAULT '{}',
    attachment         TEXT NOT NULL DEFAULT '',
    discoverable       BOOL NOT NULL DEFAULT false,
    user_verified      BOOL NOT NULL DEFAULT false,
    backup_eligible    BOOL NOT NULL DEFAULT false,
    backup_state       BOOL NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at       TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX user_webauthn_credentials_credential_id_idx
    ON user_webauthn_credentials (credential_id);

CREATE INDEX user_webauthn_credentials_user_idx
    ON user_webauthn_credentials (user_id, created_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE user_mfa_recovery_codes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash          TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX user_mfa_recovery_codes_user_code_idx
    ON user_mfa_recovery_codes (user_id, code_hash);

CREATE INDEX user_mfa_recovery_codes_user_idx
    ON user_mfa_recovery_codes (user_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS user_mfa_recovery_codes_user_idx;
DROP INDEX IF EXISTS user_mfa_recovery_codes_user_code_idx;
DROP TABLE IF EXISTS user_mfa_recovery_codes;
DROP INDEX IF EXISTS user_webauthn_credentials_user_idx;
DROP INDEX IF EXISTS user_webauthn_credentials_credential_id_idx;
DROP TABLE IF EXISTS user_webauthn_credentials;
DROP INDEX IF EXISTS user_totp_factors_user_idx;
DROP TABLE IF EXISTS user_totp_factors;
DROP TABLE IF EXISTS user_mfa_settings;
-- +goose StatementEnd
