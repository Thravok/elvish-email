-- +goose NO TRANSACTION
-- +goose Up
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS scheduled_delete_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scheduled_delete_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS inactivity_delete_value INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inactivity_delete_unit TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS users_scheduled_delete_idx
    ON users (scheduled_delete_at)
    WHERE scheduled_delete_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS deleted_address_reservations (
    address_hash TEXT PRIMARY KEY,
    address_kind TEXT NOT NULL DEFAULT '',
    reserved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS deleted_address_reservations_expires_idx
    ON deleted_address_reservations (expires_at);

-- +goose Down
DROP INDEX IF EXISTS deleted_address_reservations_expires_idx;
DROP TABLE IF EXISTS deleted_address_reservations;
DROP INDEX IF EXISTS users_scheduled_delete_idx;
ALTER TABLE users
    DROP COLUMN IF EXISTS inactivity_delete_unit,
    DROP COLUMN IF EXISTS inactivity_delete_value,
    DROP COLUMN IF EXISTS scheduled_delete_reason,
    DROP COLUMN IF EXISTS scheduled_delete_at,
    DROP COLUMN IF EXISTS last_activity_at;
