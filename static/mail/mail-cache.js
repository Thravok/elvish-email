import {
  openDB,
  STORE_MAIL_META,
  STORE_MAIL_HEADERS,
  STORE_MAIL_ENVELOPES,
  get,
  put,
} from './search/db.js';
import { deriveScopedKeyFromLabel, sealJSON, openJSON } from './search/key.js';

const META_KEY = 'v1';
const CACHE_LABEL = 'elvish-mail-cache-v1';

class MailCache {
  constructor() {
    this.db = null;
    this.cacheKey = null;
    this.accountFingerprint = '';
  }

  async start({ accountFingerprint, mailCacheSeed }) {
    if (!(mailCacheSeed instanceof Uint8Array) || mailCacheSeed.length === 0) {
      throw new Error('mail cache requires mailCacheSeed');
    }
    this.db = await openDB();
    this.cacheKey = await deriveScopedKeyFromLabel(mailCacheSeed, CACHE_LABEL);
    this.accountFingerprint = String(accountFingerprint || '').trim().toUpperCase();
    await this.ensureMeta();
  }

  async ensureMeta() {
    if (!this.db || !this.cacheKey) return;
    const readTx = this.db.transaction([STORE_MAIL_META], 'readonly');
    const existingEnv = await get(readTx.objectStore(STORE_MAIL_META), META_KEY);
    const existing = existingEnv ? await openJSON(this.cacheKey, existingEnv).catch(() => null) : null;
    if (existing && existing.account_fingerprint && existing.account_fingerprint !== this.accountFingerprint) {
      await this.clearStores();
    }
    const sealed = await sealJSON(this.cacheKey, {
      schema_version: 1,
      account_fingerprint: this.accountFingerprint,
      updated_at: new Date().toISOString(),
    });
    const t = this.db.transaction([STORE_MAIL_META], 'readwrite');
    const store = t.objectStore(STORE_MAIL_META);
    await put(store, META_KEY, sealed);
    await txComplete(t);
  }

  async purge() {
    if (!this.db) this.db = await openDB();
    await this.clearStores();
  }

  async clearStores() {
    if (!this.db) return;
    const t = this.db.transaction([STORE_MAIL_META, STORE_MAIL_HEADERS, STORE_MAIL_ENVELOPES], 'readwrite');
    t.objectStore(STORE_MAIL_META).clear();
    t.objectStore(STORE_MAIL_HEADERS).clear();
    t.objectStore(STORE_MAIL_ENVELOPES).clear();
    await txComplete(t);
  }

  async getHeaders(messageIDs) {
    if (!this.db || !this.cacheKey || !Array.isArray(messageIDs) || messageIDs.length === 0) return {};
    const t = this.db.transaction([STORE_MAIL_HEADERS], 'readonly');
    const store = t.objectStore(STORE_MAIL_HEADERS);
    const entries = [];
    for (const messageID of messageIDs) {
      const key = String(messageID || '').trim();
      if (!key) continue;
      const env = await get(store, key);
      if (env) entries.push([key, env]);
    }
    // Do not await openJSON (async crypto) while the IDB transaction is still
    // expected to receive further requests — the tx auto-commits on yield.
    const out = {};
    for (const [key, env] of entries) {
      const opened = await openJSON(this.cacheKey, env).catch(() => null);
      if (opened) out[key] = opened;
    }
    return out;
  }

  async putHeader(messageID, version, payload) {
    if (!this.db || !this.cacheKey || !messageID || !payload) return;
    const sealed = await sealJSON(this.cacheKey, {
      version: String(version || ''),
      payload,
      cached_at: new Date().toISOString(),
    });
    const t = this.db.transaction([STORE_MAIL_HEADERS], 'readwrite');
    await put(t.objectStore(STORE_MAIL_HEADERS), String(messageID), sealed);
    await txComplete(t);
  }

  async getEnvelope(messageID) {
    if (!this.db || !this.cacheKey || !messageID) return null;
    const t = this.db.transaction([STORE_MAIL_ENVELOPES], 'readonly');
    const env = await get(t.objectStore(STORE_MAIL_ENVELOPES), String(messageID));
    if (!env) return null;
    return await openJSON(this.cacheKey, env).catch(() => null);
  }

  async putEnvelope(messageID, version, payload) {
    if (!this.db || !this.cacheKey || !messageID || !payload) return;
    const sealed = await sealJSON(this.cacheKey, {
      version: String(version || ''),
      payload,
      cached_at: new Date().toISOString(),
    });
    const t = this.db.transaction([STORE_MAIL_ENVELOPES], 'readwrite');
    await put(t.objectStore(STORE_MAIL_ENVELOPES), String(messageID), sealed);
    await txComplete(t);
  }

  extractVersion(message) {
    if (!message) return '';
    return [
      String(message.id || ''),
      String(message.body_blob_ref || ''),
      String(message.body_size_bytes || ''),
      String(message.header_ciphertext_b64 || ''),
    ].join(':');
  }

  unwrapVersionedPayload(entry, version) {
    if (!entry || entry.version !== String(version || '') || !entry.payload) return null;
    return entry.payload;
  }
}

function txComplete(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('mail cache tx aborted'));
  });
}

window.ElvishMailCache = new MailCache();
