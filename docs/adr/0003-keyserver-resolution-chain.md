# ADR 0003 — Keyserver resolution chain

**Status:** Accepted (2026-05)
**Supersedes:** —
**Related:** [0004 — Per-field metadata consent](./0004-per-field-metadata-consent.md), [0005 — Account key hierarchy](./0005-account-key-hierarchy.md)

## Context

To send PGP-encrypted mail to an external recipient we need their public key. The Elvish server runs a deterministic, cacheable lookup chain instead of asking the user to copy/paste keys. The chain must:

- Prefer high-trust sources (WKD published by the recipient's domain).
- Tolerate partial outages (HKPS pools and Proton's API are external).
- Avoid spamming third parties on negative lookups.
- Survive supply-chain compromise of one source (Proton, keys.openpgp.org, …).

## Decision

`internal/keyserver.Resolver` runs sources in this fixed order:

1. **Local identity table** (`mailmeta.IdentityForEmail`) — instant, used when the recipient has an account on this server. Never expires.
2. **Cache** (`mailmeta.contact_pgp_keys` + Valkey negative cache) — positive hits stored 24h in Cockroach, negative hits 5m in Valkey.
3. **WKD** (Web Key Directory, RFC draft + de facto). Tries the **advanced** form first (`https://openpgpkey.<domain>/.well-known/openpgpkey/<domain>/hu/<hash>`), then **direct** (`https://<domain>/.well-known/openpgpkey/hu/<hash>`).
4. **Proton Mail** API + HKP fallback. Auto-promoted to position 1 (after the local table) when the address ends in `proton.me`, `protonmail.com`, `protonmail.ch`, or `pm.me` (`ProtonAutoBoost = true` in the resolver). Falls back to Proton's HKP server if the API is unreachable.
5. **HKPS pools**: `keys.openpgp.org`, then `keyserver.ubuntu.com`.

Sources have a 6-second per-call deadline by default. Cache writes are best-effort (logged, never fail the lookup). Negative cache TTLs are short to recover quickly when a recipient publishes a new key.

The resolver returns `KeyHit{ Source, Fingerprint, Armored, VerifiedUIDMatch, ExpiresAt, ProtonKTState }`. The `Source` string flows through to UI badges (`source-wkd_advanced`, `source-proton`, …) so the user can see which authority the key came from.

### Out of scope for v1

- WKD-as-a-service intermediaries (we make HTTP requests directly).
- Proton Key Transparency (KT) verification (`ProtonKTState` is populated when the source returns it; we do not verify the inclusion proof yet).
- DANE / SMIMEA / OPENPGPKEY DNS records (would require a recursive resolver with DNSSEC validation).

## Consequences

- All third-party calls go through one place; rate limits and timeouts are uniform.
- A flaky single source cannot block delivery; the next source in the chain is tried.
- The Cockroach cache makes the resolver idempotent for repeated sends to the same address (no extra HTTP per recipient).
- Negative cache lives in Valkey (cheap to rotate); positive cache lives in Cockroach (durable, owner-scoped).
- We can revoke trust in one source by deleting it from `DefaultChain` without code changes elsewhere.
