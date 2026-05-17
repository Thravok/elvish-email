# ADR 0008 — Local-only body search

**Status:** Accepted (2026-05)
**Related:** [0004 — Per-field consent](./0004-per-field-metadata-consent.md), [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md)

## Context

Users want full-text search over their inbox bodies. The naive design — push body terms to a server-side index for fast querying — undermines the entire E2EE proposition: the server (or any process with read access to the index) can reconstruct the message content from the inverted file. Even consent-gated metadata search (ADR 0004) intentionally excludes bodies because the body is the message.

We need a search that is:

1. **Useful**: ranked, fast, BM25-quality results, snippet previews.
2. **Local-only**: no body content (or anything derived from it) leaves the device.
3. **Per-identity**: rotating an identity rebuilds the index instead of leaking it.
4. **Cancellable**: typing produces no per-keystroke server traffic.

## Decision

`static/mail/search/` ships a Web Worker that owns an IndexedDB-backed AES-256-GCM-encrypted body index per identity. There is intentionally **no** `/api/v1/mail/search/body` route, ever. CI enforces this with a grep guard in `make lint` and a Go test in `internal/httpserver/no_search_body_test.go`. Playwright's `e2e/tests/search.spec.ts` asserts the route returns 404.

### Architecture

| File | Role |
|------|------|
| `db.js` | IndexedDB schema (`elvish-search`, version 1), CRUD helpers |
| `key.js` | HKDF-SHA256 derivation + AES-256-GCM seal/open envelopes |
| `tokenize.js` | Unicode word segmentation (`Intl.Segmenter` + regex fallback) |
| `worker.js` | Web Worker that owns the index for one identity |
| `search.js` | Main-thread `LocalSearch` + `serverMetadataSearch` wrapper |

### Index key

```
identitySecretBytes = openpgp.privKey.subkeys[encSubkey].keyPacket.privateParams.d   // 32 bytes for X25519
salt                = "elvish-search-v1"
indexKey            = HKDF-SHA256(identitySecretBytes, salt, info="search", L=32)
```

Stable across unlocks (no reindex per login) and bound to the identity (rotating the identity invalidates the index — the worker rebuilds on next sync). Key never persists; lives only in the worker's memory while the user is unlocked.

### Index schema

| Object store | Key | Value (after AES-GCM unwrap) |
|--------------|-----|------------------------------|
| `meta` | `"v1"` | `{schema_version, identity_fingerprint, last_indexed_at}` |
| `headers` | `message_id` | decrypted manifest header cache |
| `terms` | lowercased token | `{term, df, postings: [{message_id, tf, positions[]}]}` |
| `docs` | `message_id` | `{indexed_at, term_count, snippet}` |

Every value is `{nonce_b64, ciphertext_b64}`. Keys are not encrypted — IDB requires plain keys, so the **set** of indexed terms / message ids is observable to JavaScript with same-origin access (which can already read the unlocked identity key from `KeyVault`). Documented trade-off vs. the alternative of fully opaque keys (linear scans on every search).

### Search

`LocalSearch.searchAll(q, opts)` merges three streams:

- Local body search via the worker (BM25, `k1=1.2, b=0.75`).
- `serverMetadataSearch(q, consentedFields)` — only if the user has consented to those fields in `mail_metadata_consent`. Routes through `GET /api/v1/mail/search/metadata`.
- Optional `headersFallback` — runs against the local `headers` store for fields the user has NOT consented to.

Hits include a `sources: [...]` array; the UI renders per-result source pills (`local-body`, `server-metadata`, `local-metadata`).

### Eviction & limits

- `ELVISH_SEARCH_MAX_INDEX_MB` (default `200`): worker LRU-evicts oldest `docs` rows + their term postings when `navigator.storage.estimate()` reports usage above the cap.
- `ELVISH_SEARCH_INDEX_DEFAULT` (default `1`): user can disable indexing entirely in Settings → Search; the existing index is purged on disable.
- Index is per-identity. Switching the default identity activates a different IndexedDB index (or builds one if the new identity has none).

### Cross-device sync

**Out of scope for v1.** Each device builds its own local index. Documented in Settings → Search and `static/mail/search/README.md`. Future work sketches a "client-encrypted index sync" approach (PGP-wrapped index snapshot uploaded to object storage, downloaded by the second device) — not implemented.

## Threat model

- The server **cannot** see body content (no body-search endpoint, enforced by lint guard + test).
- The server **can** see consented metadata projections (`opt_in_metadata_by_user` in Scylla). Consent is forward-only; toggling on does not retroactively decrypt past messages.
- The local index leaks term and message-id key sets to same-origin JS. With the identity key unlocked, that JS can already read message bodies — so the leak does not lower the bar.
- Stored values are AES-256-GCM ciphertext with random per-write nonces; raw IDB inspection cannot recover terms or snippets.

## Consequences

- The user gets fast ranked search without the server ever seeing body content.
- We cannot offer "search across devices without re-indexing" until someone implements the client-encrypted snapshot sync.
- The index lives in IndexedDB; clearing site data wipes it. Documented in Settings → Search with a "Reindex now" button.
