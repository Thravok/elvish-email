-- +goose Up
-- +goose StatementBegin

-- Per-user saved / trusted OpenPGP public keys for contacts (separate from global contact_pgp_keys resolver cache).
CREATE TABLE mail_user_contact_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    fingerprint     TEXT NOT NULL,
    armored_public  TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT '',
    trusted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, email, fingerprint)
);

CREATE INDEX mail_user_contact_keys_user_email ON mail_user_contact_keys (user_id, email);
CREATE INDEX mail_user_contact_keys_user_trusted ON mail_user_contact_keys (user_id, email) WHERE trusted_at IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS mail_user_contact_keys;
-- +goose StatementEnd
