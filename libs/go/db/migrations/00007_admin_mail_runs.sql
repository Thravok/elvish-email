-- +goose Up
-- +goose StatementBegin
-- Admin/system mail audit runs and outbox source tagging.

CREATE TABLE admin_mail_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    audience_kind   TEXT NOT NULL DEFAULT 'selected',
    sender_addr     TEXT NOT NULL DEFAULT '',
    subject         TEXT NOT NULL DEFAULT '',
    body_sha256     TEXT NOT NULL DEFAULT '',
    recipient_count INT NOT NULL DEFAULT 0,
    queued_count    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_mail_runs_created_at ON admin_mail_runs (created_at DESC);

ALTER TABLE mail_outbox ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_outbox ADD COLUMN admin_run_id UUID REFERENCES admin_mail_runs (id) ON DELETE SET NULL;

CREATE INDEX mail_outbox_source_created_at ON mail_outbox (source, created_at DESC);
CREATE INDEX mail_outbox_admin_run_id ON mail_outbox (admin_run_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS mail_outbox_admin_run_id;
DROP INDEX IF EXISTS mail_outbox_source_created_at;

ALTER TABLE mail_outbox DROP COLUMN IF EXISTS admin_run_id;
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS source;

DROP INDEX IF EXISTS admin_mail_runs_created_at;
DROP TABLE IF EXISTS admin_mail_runs;
-- +goose StatementEnd
