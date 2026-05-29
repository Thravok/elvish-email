-- +goose Up
-- +goose StatementBegin
CREATE TABLE operator_settings (
    id TEXT PRIMARY KEY,
    public_base_url TEXT NOT NULL DEFAULT '',
    platform_mail_domain TEXT NOT NULL DEFAULT '',
    web_origins TEXT NOT NULL DEFAULT '',
    cookie_domain TEXT NOT NULL DEFAULT '',
    registration_closed BOOL NOT NULL DEFAULT false,
    paid_features_enabled BOOL NOT NULL DEFAULT false,
    trust_forwarded_for BOOL NOT NULL DEFAULT false,
    content_cache_sec INT NOT NULL DEFAULT 10,
    smtp_rate_limit_per_hour INT NOT NULL DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS operator_settings;
-- +goose StatementEnd
