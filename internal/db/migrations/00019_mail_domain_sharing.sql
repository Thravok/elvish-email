-- +goose Up
-- +goose StatementBegin

-- Who may create mailbox identities on a verified custom domain (DNS/DKIM still owned by owner_user_id).
ALTER TABLE mail_domains
    ADD COLUMN IF NOT EXISTS share_mode TEXT NOT NULL DEFAULT 'owner_only';

ALTER TABLE mail_domains
    DROP CONSTRAINT IF EXISTS mail_domains_share_mode_check;

ALTER TABLE mail_domains
    ADD CONSTRAINT mail_domains_share_mode_check CHECK (
        share_mode IN ('owner_only', 'all_verified_users', 'allowlist')
    );

CREATE TABLE IF NOT EXISTS mail_domain_allowlist (
    domain    TEXT NOT NULL REFERENCES mail_domains (domain) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (domain, user_id)
);

CREATE INDEX IF NOT EXISTS mail_domain_allowlist_user ON mail_domain_allowlist (user_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS mail_domain_allowlist_user;
DROP TABLE IF EXISTS mail_domain_allowlist;

ALTER TABLE mail_domains DROP CONSTRAINT IF EXISTS mail_domains_share_mode_check;
ALTER TABLE mail_domains DROP COLUMN IF EXISTS share_mode;

-- +goose StatementEnd
