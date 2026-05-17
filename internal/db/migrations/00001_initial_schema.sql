-- +goose Up
-- +goose StatementBegin
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    is_admin BOOL NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    display_date TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    bytes TEXT NOT NULL DEFAULT '',
    reach TEXT NOT NULL DEFAULT '',
    draft BOOL NOT NULL DEFAULT false,
    body_markdown TEXT NOT NULL,
    detached_openpgp_sig TEXT NOT NULL DEFAULT '',
    detached_minisig TEXT NOT NULL DEFAULT '',
    openpgp_key_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pgp_public_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint16 TEXT NOT NULL UNIQUE,
    full_key_id TEXT NOT NULL DEFAULT '',
    armored TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_config (
    id TEXT PRIMARY KEY,
    home_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE uptime_settings (
    id TEXT PRIMARY KEY,
    enabled BOOL NOT NULL DEFAULT true,
    interval TEXT NOT NULL DEFAULT '5m',
    base_url TEXT NOT NULL DEFAULT '',
    include_tools_from_home BOOL NOT NULL DEFAULT true,
    endpoints JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE uptime_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    at TIMESTAMPTZ NOT NULL,
    results JSONB NOT NULL
);

CREATE INDEX uptime_runs_at_desc ON uptime_runs (at DESC);

CREATE TABLE uptime_agg (
    id TEXT PRIMARY KEY,
    period_ym TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    targets JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE mail_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    folder TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    body BYTEA NOT NULL,
    from_addr TEXT NOT NULL DEFAULT '',
    to_addrs TEXT[] NOT NULL DEFAULT '{}',
    source TEXT NOT NULL DEFAULT '',
    size_bytes INT NOT NULL DEFAULT 0
);

CREATE INDEX mail_messages_user_folder_created ON mail_messages (user_id, folder, created_at DESC);

CREATE TABLE mail_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL,
    payload BYTEA NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX mail_outbox_pending_created ON mail_outbox (status, created_at);

CREATE TABLE legacy_mongo_user_map (
    mongo_object_id_hex TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS legacy_mongo_user_map;
DROP TABLE IF EXISTS mail_outbox;
DROP TABLE IF EXISTS mail_messages;
DROP TABLE IF EXISTS uptime_agg;
DROP TABLE IF EXISTS uptime_runs;
DROP TABLE IF EXISTS uptime_settings;
DROP TABLE IF EXISTS site_config;
DROP TABLE IF EXISTS pgp_public_keys;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
