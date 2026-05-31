-- +goose Up
-- +goose StatementBegin
ALTER TABLE user_identity_keys
    ADD COLUMN IF NOT EXISTS avatar_data_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS status_badge_enabled BOOL NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS identity_profile_visibility (
    viewer_user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    remote_user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    remote_identity_fingerprint TEXT NOT NULL,
    avatar_visible             BOOL NOT NULL DEFAULT true,
    status_visible             BOOL NOT NULL DEFAULT false,
    first_shared_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_visible_at          TIMESTAMPTZ,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (viewer_user_id, remote_identity_fingerprint)
);

CREATE INDEX IF NOT EXISTS identity_profile_visibility_remote_idx
    ON identity_profile_visibility (remote_user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS identity_profile_visibility_remote_idx;
DROP TABLE IF EXISTS identity_profile_visibility;
ALTER TABLE user_identity_keys
    DROP COLUMN IF EXISTS status_badge_enabled,
    DROP COLUMN IF EXISTS avatar_color,
    DROP COLUMN IF EXISTS avatar_data_url;
-- +goose StatementEnd
