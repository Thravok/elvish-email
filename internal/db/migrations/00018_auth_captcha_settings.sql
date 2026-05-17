-- +goose Up
-- +goose StatementBegin
CREATE TABLE auth_captcha_settings (
    id TEXT PRIMARY KEY,
    enabled BOOL NOT NULL DEFAULT false,
    widget_api_endpoint TEXT NOT NULL DEFAULT '',
    secret TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS auth_captcha_settings;
-- +goose StatementEnd
