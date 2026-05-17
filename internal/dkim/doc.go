// Package dkim implements DKIM signing per RFC 6376 (relaxed/relaxed canonicalization).
//
// Supports rsa-sha256 (RSA-2048+) and ed25519-sha256 (RFC 8463). Verification is not
// required for outbound flow; this package focuses on signing.
package dkim
