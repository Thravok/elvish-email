// Package mailmeta is the Cockroach-backed control plane for the mail subsystem:
//
//   - Identity: user_account_keys, user_identity_keys, identity_secret_blobs
//   - Settings: user_mail_settings (legacy mail_metadata_consent table unused)
//   - Domains and aliases: mail_domains, mail_aliases
//   - Durable outbox state (NOT payload): mail_outbox, mail_bounces
//   - Audit ledger: mail_ingest_ledger
//   - Resolver cache: contact_pgp_keys
//
// Replaces the previous internal/mailstore package. Body bytes never live here.
package mailmeta
