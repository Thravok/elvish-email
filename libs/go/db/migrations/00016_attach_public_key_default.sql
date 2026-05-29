-- +goose Up
-- +goose StatementBegin
-- Default: attach sender public key to OpenPGP-direct outbound messages (user can override per compose).
ALTER TABLE user_mail_settings
    ADD COLUMN IF NOT EXISTS attach_public_key_default BOOL NOT NULL DEFAULT false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE user_mail_settings
    DROP COLUMN IF EXISTS attach_public_key_default;
-- +goose StatementEnd
