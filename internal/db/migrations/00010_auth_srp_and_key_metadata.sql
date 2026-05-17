-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
    ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'bcrypt',
    ADD COLUMN srp_salt BYTEA,
    ADD COLUMN srp_verifier BYTEA,
    ADD COLUMN srp_group TEXT NOT NULL DEFAULT '',
    ADD COLUMN srp_hash TEXT NOT NULL DEFAULT '';

CREATE INDEX users_auth_method_idx ON users (auth_method);

ALTER TABLE user_account_keys
    ADD COLUMN algorithm TEXT NOT NULL DEFAULT 'openpgp-ecc-curve25519',
    ADD COLUMN key_version INT NOT NULL DEFAULT 1;

ALTER TABLE identity_secret_blobs
    ADD COLUMN algorithm TEXT NOT NULL DEFAULT 'openpgp-ecc-curve25519',
    ADD COLUMN key_version INT NOT NULL DEFAULT 1;

CREATE TABLE user_device_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label               TEXT NOT NULL DEFAULT '',
    encryption_algorithm TEXT NOT NULL DEFAULT '',
    signing_algorithm   TEXT NOT NULL DEFAULT '',
    public_material     JSONB NOT NULL DEFAULT '{}',
    wrapped_secret      BYTEA NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_device_keys_user_idx ON user_device_keys (user_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS user_device_keys_user_idx;
DROP TABLE IF EXISTS user_device_keys;
ALTER TABLE identity_secret_blobs
    DROP COLUMN IF EXISTS key_version,
    DROP COLUMN IF EXISTS algorithm;
ALTER TABLE user_account_keys
    DROP COLUMN IF EXISTS key_version,
    DROP COLUMN IF EXISTS algorithm;
DROP INDEX IF EXISTS users_auth_method_idx;
ALTER TABLE users
    DROP COLUMN IF EXISTS srp_hash,
    DROP COLUMN IF EXISTS srp_group,
    DROP COLUMN IF EXISTS srp_verifier,
    DROP COLUMN IF EXISTS srp_salt,
    DROP COLUMN IF EXISTS auth_method;
-- +goose StatementEnd
