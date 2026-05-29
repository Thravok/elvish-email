-- +goose Up
-- +goose StatementBegin
ALTER TABLE admin_mail_runs
    ADD COLUMN IF NOT EXISTS send_mode TEXT NOT NULL DEFAULT 'plaintext',
    ADD COLUMN IF NOT EXISTS attachment_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attachment_bytes BIGINT NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE admin_mail_runs
    DROP COLUMN IF EXISTS attachment_bytes,
    DROP COLUMN IF EXISTS attachment_count,
    DROP COLUMN IF EXISTS send_mode;
-- +goose StatementEnd
