-- +goose Up
-- +goose StatementBegin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ui_theme TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_ui_theme_check;

ALTER TABLE users
  ADD CONSTRAINT users_ui_theme_check CHECK (ui_theme IN ('auto', 'dark', 'light'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ui_theme_check;
ALTER TABLE users DROP COLUMN IF EXISTS ui_theme;
-- +goose StatementEnd
