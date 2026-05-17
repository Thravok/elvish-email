// Package mailpipe orchestrates writes across the four storage layers when a
// message arrives.
//
// Three entrypoints:
//
//   - Ingest          — external SMTP inbound (gateway-encrypts cleartext to recipient pubkey).
//   - IngestSent      — authenticated submission (writes to sender's sent folder).
//   - IngestInternal  — local user-to-user (already client-encrypted).
//
// Each call:
//  1. Resolves recipient identity (mailmeta.IdentityForEmail).
//  2. PGP-encrypts the body if not already ciphertext.
//  3. Writes ciphertext to blobstore (mail/{user}/{message}/body.enc).
//  4. Writes a manifest row + mailbox listing row to Scylla (with PGP-encrypted header_ciphertext).
//  5. If consent allows, writes sparse plaintext metadata to opt_in_metadata_by_user.
//  6. Appends an audit row to mail_ingest_ledger (Cockroach).
//  7. Zeroes the cleartext buffer.
//
// On any failure after the blob upload, prior writes are compensated with deletes.
package mailpipe
