// Package maillinks is the Cockroach-backed store for protected-link send mode.
//
// A protected link is a one-shot or N-shot reference to a fully encrypted
// payload in object storage. The sender chooses a password client-side; the
// server only stores the KDF parameters, the AES-GCM-wrapped message key, and
// the ciphertext blob. The recipient hits a public page, types the password,
// and the browser derives the KEK + unwraps the message key + decrypts the
// body. The password NEVER touches the server.
//
// Schema: mail_protected_links (see migration 00004).
package maillinks
