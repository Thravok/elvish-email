# ADR 0005 — Skiff-style account/identity key hierarchy

**Status:** Accepted (2026-05)
**Related:** [0004 — Per-field consent](./0004-per-field-metadata-consent.md), [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md)

## Context

The user owns one account and zero or more **identities** (each one a distinct receive-address with its own PGP keypair: `alice@elvish.email`, `alice+work@elvish.email`, …). We need each identity's private key to be unwrappable in the browser at every login, but never plaintext on the server, and we need rotating an identity to be cheap (no re-deriving the user's password-derived key).

Skiff's whitepaper describes a two-layer scheme that fits this exactly: a password-derived **Key Encryption Key (KEK)** wraps an **account private key**; the account public key wraps each identity's private key.

## Decision

### Layer 1 — account key

At `/register` the browser:

1. Generates 16 bytes of random salt.
2. Derives the 32-byte KEK with **Argon2id** (`m=64MiB, t=3, p=1`) when `crypto.subtle.deriveBits` exposes Argon2id (Chrome 122+ behind a flag, Safari planned). Otherwise falls back to **PBKDF2-SHA256 with 600 000 iterations** (OWASP 2023 baseline).
3. Generates a Curve25519 PGP keypair via OpenPGP.js (`openpgp.generateKey({ type: 'ecc', curve: 'curve25519' })`).
4. Wraps the account private key with **AES-256-GCM**: nonce is 12 random bytes, AAD is empty, output is `nonce || ciphertext || tag`.
5. POSTs `{armored_public, wrapped_secret_b64, kdf, kdf_salt_b64, kdf_params_json, identities: [...]}` to `/api/v1/account-key/bootstrap`.

The server stores `armored_public`, the wrapped blob, and the KDF parameters in `user_account_keys` (CockroachDB). It never sees the password and never sees the unwrapped private key.

### Layer 2 — identity keys

For each identity (initial bootstrap + later additions via `/api/v1/identities`):

1. Generate a Curve25519 PGP keypair.
2. PGP-encrypt the **identity private key** to the **account public key** (`openpgp.encrypt({ message, encryptionKeys: accountPubKey, format: 'armored' })`).
3. Store the wrapped blob in `identity_secret_blobs` with `wrap_method = 'account-key'`.

The identity public key is what we publish via WKD (gated by `user_mail_settings.wkd_publish`) and what we hand to the keyserver chain.

### Unlock flow

At `/login` the browser:

1. Fetches `/api/v1/account-key/me` and `/api/v1/identities` (returns the wrapped blobs + KDF parameters).
2. Re-derives the KEK from the password + salt + KDF parameters.
3. AES-GCM decrypts the account private key into `KeyVault.account` (in-memory only).
4. For each identity, PGP-decrypts the wrapped identity private key with the unlocked account key and stores it in `KeyVault.identities[fingerprint]`.

`KeyVault` exposes `decryptForIdentity(fingerprint, ciphertext)` and `signForIdentity(fingerprint, message)`. It auto-locks after `keyvault_idle_min` minutes (default 15) and on `visibilitychange` to `hidden` for >5min.

### Rotation

- **Password change**: derive new KEK, AES-GCM re-wrap the unchanged account private key, PUT to `/api/v1/account-key/me`. Identity blobs are untouched.
- **Account key rotation**: generate a new account keypair, re-wrap each identity private key with the new account public key, atomic swap on the server.
- **Identity rotation**: generate a new identity keypair, publish new public key via WKD, mark the old one inactive (revocation cert kept in `user_identity_keys.revocation_certificate`). Past messages remain decryptable because the old private key blob is still wrapped by the same account key.

### Rejected alternatives

- **One key per account** (no identity layer): can't have multiple receive addresses with separate keypairs without sharing the same private key across them.
- **Browser persists the unwrapped account key** (e.g. in IndexedDB): violates "no plaintext keys at rest", reduces to "trust the device for everything".
- **Server holds the wrapped identity blobs as opaque ciphertext** (already true) **and rotates them server-side**: requires an oracle that can decrypt with the account key, which violates the invariant.

## Consequences

- The server can recover the user's mailbox if they remember their password (deterministic key derivation), without ever touching the password.
- A device compromise after unlock exposes the unlocked KeyVault contents, but only for the idle-timeout window.
- Adding an identity is one round-trip: client wraps with the cached account public key, server stores the blob.
- Recovery without the password is impossible by design (matches Skiff's threat model). Future work: optional shamir-shared recovery key.
