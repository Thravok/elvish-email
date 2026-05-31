-- +goose Up
-- Staff accounts for ELVish Console (separate from platform users).

CREATE TABLE IF NOT EXISTS staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN ('super_admin', 'operator', 'support_agent')),
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users (lower(email));

CREATE TABLE IF NOT EXISTS staff_mfa_settings (
    staff_id UUID PRIMARY KEY REFERENCES staff_users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_totp_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    secret_encrypted BYTEA NOT NULL,
    label TEXT NOT NULL DEFAULT 'Authenticator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    metadata_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_log_created ON staff_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_actor ON staff_audit_log (actor_staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_mailbox_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    platform_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_key_vault (
    platform_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_account_key BYTEA NOT NULL,
    encrypted_identity_keys_json BYTEA NOT NULL,
    vault_key_id TEXT NOT NULL DEFAULT 'default',
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS support_key_vault;
DROP TABLE IF EXISTS support_mailbox_config;
DROP TABLE IF EXISTS staff_audit_log;
DROP TABLE IF EXISTS staff_mfa_recovery_codes;
DROP TABLE IF EXISTS staff_totp_factors;
DROP TABLE IF EXISTS staff_mfa_settings;
DROP TABLE IF EXISTS staff_users;
