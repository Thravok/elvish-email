-- +goose NO TRANSACTION
-- +goose Up
-- Per-message expiry for Elvish-to-Elvish mail (sender-chosen TTL and optional read cap).

ALTER TABLE mail_message_lifecycle
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS max_reads BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reads BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS burned_at TIMESTAMPTZ;

ALTER TABLE mail_message_lifecycle
    DROP CONSTRAINT IF EXISTS mail_message_lifecycle_max_reads_nonneg;

ALTER TABLE mail_message_lifecycle
    ADD CONSTRAINT mail_message_lifecycle_max_reads_nonneg CHECK (max_reads >= 0);

ALTER TABLE mail_message_lifecycle
    DROP CONSTRAINT IF EXISTS mail_message_lifecycle_reads_nonneg;

ALTER TABLE mail_message_lifecycle
    ADD CONSTRAINT mail_message_lifecycle_reads_nonneg CHECK (reads >= 0);

CREATE INDEX IF NOT EXISTS mail_message_lifecycle_expires_at
    ON mail_message_lifecycle (expires_at)
    WHERE expires_at IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS mail_message_lifecycle_expires_at;

ALTER TABLE mail_message_lifecycle
    DROP CONSTRAINT IF EXISTS mail_message_lifecycle_reads_nonneg;

ALTER TABLE mail_message_lifecycle
    DROP CONSTRAINT IF EXISTS mail_message_lifecycle_max_reads_nonneg;

ALTER TABLE mail_message_lifecycle
    DROP COLUMN IF EXISTS burned_at,
    DROP COLUMN IF EXISTS reads,
    DROP COLUMN IF EXISTS max_reads,
    DROP COLUMN IF EXISTS expires_at;
