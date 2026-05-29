-- +goose Up
-- +goose StatementBegin
CREATE TABLE admin_mail_settings (
    id TEXT PRIMARY KEY,
    dkim_selector TEXT NOT NULL DEFAULT 'mail',
    dkim_domain TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS admin_mail_settings;
-- +goose StatementEnd
