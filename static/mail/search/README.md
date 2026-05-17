# `static/mail/search/` — Local-only mail body search

This directory implements the **client-side, encrypted, IndexedDB-backed full-text body index** for the Elvish mail UI. There is intentionally no server-side body-search endpoint, regardless of the user's per-field metadata consent settings (see ADR 0008 and `docs/e2ee-mail-spec.md` § "Search").

## Files

| File | Role |
|------|------|
| `db.js` | IndexedDB schema (`elvish-search`, version 1) and CRUD helpers |
| `key.js` | HKDF-SHA256 key derivation + AES-256-GCM seal/open envelopes |
| `tokenize.js` | Unicode-aware word segmentation (`Intl.Segmenter` + regex fallback) |
| `worker.js` | Web Worker that owns the index for one identity |
| `search.js` | Main-thread `LocalSearch` class + `serverMetadataSearch()` |

## Schema

| Object store | Key | Value (after AES-GCM unwrap) |
|--------------|-----|------------------------------|
| `meta` | `"v1"` | `{ schema_version, identity_fingerprint, last_indexed_at }` |
| `headers` | `message_id` | decrypted manifest header cache (subject/from/to/date/thread_id/folder) |
| `terms` | lowercased token | `{ term, df, postings: [ { message_id, tf, positions[] } ] }` |
| `docs` | `message_id` | `{ indexed_at, term_count, snippet }` |

Every value is `{ nonce_b64, ciphertext_b64 }`. Keys are not encrypted — IndexedDB requires plain keys, so the **set** of indexed terms / message ids is observable to JavaScript with same-origin access (which can already read the unlocked identity key from `KeyVault`). This is documented as an explicit trade-off in ADR 0008.

## Index key derivation

```
identitySecretBytes = openpgp.privKey.subkeys[encSubkey].keyPacket.privateParams.d
salt                = "elvish-search-v1"
indexKey            = HKDF-SHA256(identitySecretBytes, salt, info="search", L=32)
```

Stable across unlocks (so we don't reindex on each login) and bound to the identity (rotating the identity key invalidates the index — the worker rebuilds on next sync). The key never persists; it lives only in the worker's memory while the user is unlocked.

## Indexer flow

1. UI postMessages `{kind:'index', messageId, blobUrl}` per manifest.
2. Worker fetches the PGP ciphertext, decrypts with the identity private key, strips MIME/HTML, tokenizes with `Intl.Segmenter`, lowercases, drops short and stopword tokens.
3. Per-term postings are merged into the `terms` store; a `docs` row stores the encrypted snippet for hit previews.
4. The cleartext body buffer is zeroed in a `finally` block.
5. UI receives `{kind:'indexed', messageId, termCount}` and reflects "searchable" status in the message list.

Indexing is throttled at the UI layer (`ELVISH_SEARCH_INDEX_RATE_PER_SEC`, default 5).

## Search

`LocalSearch.searchAll(q, opts)` merges three streams into one ranked list:

- Local body search via the worker (BM25, `k1=1.2, b=0.75`).
- `serverMetadataSearch(q, consentedFields)` (only if the user has consented to those fields, via `mail_metadata_consent`).
- Optional `headersFallback` for fields the user has NOT consented to plaintext for, run against the local `headers` store.

Hits include a `sources: [...]` array so the UI can render per-result source pills.

## Eviction & limits

- `ELVISH_SEARCH_MAX_INDEX_MB` (default `200`): worker LRU-evicts oldest `docs` rows + their term postings when `navigator.storage.estimate()` reports usage above the cap.
- `ELVISH_SEARCH_INDEX_DEFAULT` (default `1`): user can disable indexing entirely in Settings → Search; the existing index is purged on disable.
- Index is per-identity. Switching the default identity activates a different IndexedDB index (or builds one if the new identity has none).

## Cross-device sync

**Out of scope for v1.** Each device builds its own local index. ADR 0008 sketches a future "client-encrypted index sync" approach (PGP-wrapped index snapshot uploaded to object storage, downloaded by the second device). Not implemented.

## Threat model

- The server **cannot** see body content. There is no body-search endpoint and `make lint` enforces this with a grep guard (`! rg -n 'search/body' internal/httpserver/`).
- The server **can** see consented metadata projections (`opt_in_metadata_by_user` in Scylla). Consent is forward-only: toggling a field on does not retroactively decrypt past messages.
- The local index leaks term and message-id key sets to same-origin JS. With the identity key unlocked, that JS can already read message bodies — so the leak does not lower the bar.
- Stored values are AES-256-GCM ciphertext with random per-write nonces; raw IDB inspection cannot recover terms or snippets.
