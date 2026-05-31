-- +goose Up
-- +goose StatementBegin

-- Mode B: protected-link send mode. Sender uploads a fully encrypted payload + a
-- KDF-wrapped message key. The recipient receives a notification email containing
-- a URL like https://{host}/m/{token}; entering the sender-shared password in the
-- browser derives the KEK, unwraps the message key, and decrypts the body locally.
-- The server NEVER sees the password and NEVER sees the plaintext body.
CREATE TABLE mail_protected_links (
    token              TEXT PRIMARY KEY,                    -- 43-char base64url(32 random bytes)
    user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blob_ref           TEXT NOT NULL,                       -- secure-link/{token}.enc
    body_size_bytes    BIGINT NOT NULL DEFAULT 0,
    recipient_summary  TEXT NOT NULL DEFAULT '',            -- audit-only; comma-joined emails
    subject_hint       TEXT NOT NULL DEFAULT '',            -- shown to recipient in notification
    kdf                TEXT NOT NULL,                       -- 'argon2id' | 'pbkdf2-sha256'
    kdf_salt           BYTEA NOT NULL,                      -- 16 random bytes
    kdf_params_json    TEXT NOT NULL DEFAULT '{}',          -- {iterations, memory, parallelism}
    wrapped_msg_key    BYTEA NOT NULL,                      -- AES-GCM(KEK, msgKey) (nonce||ct||tag)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL,
    max_views          BIGINT NOT NULL DEFAULT 0,           -- 0 = unlimited
    views              BIGINT NOT NULL DEFAULT 0,
    burned_at          TIMESTAMPTZ                          -- set when last view consumed or expired
);

CREATE INDEX mail_protected_links_user ON mail_protected_links (user_id, created_at DESC);
CREATE INDEX mail_protected_links_expiry ON mail_protected_links (expires_at);

-- Mode C: plaintext relay outbound. Mark each outbox row with how the worker should dispatch it.
-- 'pgp'             - existing path; payload is opaque PGP ciphertext; transmit as-is.
-- 'plaintext_relay' - server-relay-key wrapped at rest; worker decrypts in memory then sends.
ALTER TABLE mail_outbox ADD COLUMN kind TEXT NOT NULL DEFAULT 'pgp';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE mail_outbox DROP COLUMN IF EXISTS kind;
DROP TABLE IF EXISTS mail_protected_links;
-- +goose StatementEnd
