// Package relaykey loads and uses the optional server "plaintext relay" PGP keypair.
//
// This key wraps the body of plaintext-mode outbound mail at rest so that the
// blob store never holds cleartext. The mail worker decrypts the payload in
// memory just before SMTP DATA, then wipes the buffer. This is opt-in:
// operators who do not configure ELVISH_RELAY_KEY_PATH cannot use Mode C.
//
// The relay key is NOT used for any user-facing encryption; it is solely a
// server-side at-rest wrapper for plaintext outbound mail. Rotating it
// invalidates queued plaintext_relay outbox blobs (which is acceptable: the
// content was opt-in cleartext anyway).
package relaykey
