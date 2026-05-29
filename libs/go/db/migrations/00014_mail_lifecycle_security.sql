-- +goose NO TRANSACTION
-- +goose Up
-- Mail lifecycle security: sent-copy staging, retention policies, and folder lifecycle tracking.

ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS sent_copy_body_blob_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS sent_copy_body_size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS sent_copy_header_ciphertext BYTEA;
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS sent_copy_from_addr TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_outbox ADD COLUMN IF NOT EXISTS sent_copy_message_id UUID;

ALTER TABLE user_mail_settings ADD COLUMN IF NOT EXISTS retention_setup_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS mail_folder_retention (
    user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    folder         TEXT NOT NULL,
    retention_days INT,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, folder),
    CHECK (retention_days IS NULL OR retention_days > 0)
);

CREATE INDEX IF NOT EXISTS mail_folder_retention_folder ON mail_folder_retention (folder, updated_at DESC);

CREATE TABLE IF NOT EXISTS mail_message_lifecycle (
    user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id       UUID NOT NULL,
    current_folder   TEXT NOT NULL,
    folder_entered_at TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS mail_message_lifecycle_folder_entered ON mail_message_lifecycle (current_folder, folder_entered_at ASC);
CREATE INDEX IF NOT EXISTS mail_message_lifecycle_user_folder_entered ON mail_message_lifecycle (user_id, current_folder, folder_entered_at ASC);

INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
SELECT id, 'inbox', NULL, now() FROM users
ON CONFLICT (user_id, folder) DO NOTHING;

INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
SELECT id, 'sent', 30, now() FROM users
ON CONFLICT (user_id, folder) DO NOTHING;

INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
SELECT id, 'trash', 30, now() FROM users
ON CONFLICT (user_id, folder) DO NOTHING;

INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
SELECT id, 'archive', NULL, now() FROM users
ON CONFLICT (user_id, folder) DO NOTHING;

-- +goose Down
DROP INDEX IF EXISTS mail_message_lifecycle_user_folder_entered;
DROP INDEX IF EXISTS mail_message_lifecycle_folder_entered;
DROP TABLE IF EXISTS mail_message_lifecycle;

DROP INDEX IF EXISTS mail_folder_retention_folder;
DROP TABLE IF EXISTS mail_folder_retention;

ALTER TABLE user_mail_settings DROP COLUMN IF EXISTS retention_setup_completed_at;

ALTER TABLE mail_outbox DROP COLUMN IF EXISTS sent_copy_message_id;
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS sent_copy_from_addr;
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS sent_copy_header_ciphertext;
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS sent_copy_body_size_bytes;
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS sent_copy_body_blob_ref;
