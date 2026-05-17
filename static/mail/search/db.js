// IndexedDB schema and open/upgrade helpers for the local mail search index.
//
// All values are AES-GCM ciphertext envelopes shaped as
//   { nonce_b64: string, ciphertext_b64: string }
// because IDB requires plain keys (so terms / message_ids leak via key
// enumeration only, which is documented in ADR 0008 + README in this folder).

export const DB_NAME = 'elvish-search';
export const DB_VERSION = 2;
export const STORE_META = 'meta';
export const STORE_HEADERS = 'headers';
export const STORE_TERMS = 'terms';
export const STORE_DOCS = 'docs';
export const STORE_MAIL_META = 'mail_meta';
export const STORE_MAIL_HEADERS = 'mail_headers';
export const STORE_MAIL_ENVELOPES = 'mail_envelopes';

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_HEADERS)) db.createObjectStore(STORE_HEADERS);
      if (!db.objectStoreNames.contains(STORE_TERMS)) db.createObjectStore(STORE_TERMS);
      if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS);
      if (!db.objectStoreNames.contains(STORE_MAIL_META)) db.createObjectStore(STORE_MAIL_META);
      if (!db.objectStoreNames.contains(STORE_MAIL_HEADERS)) db.createObjectStore(STORE_MAIL_HEADERS);
      if (!db.objectStoreNames.contains(STORE_MAIL_ENVELOPES)) db.createObjectStore(STORE_MAIL_ENVELOPES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function tx(db, stores, mode = 'readonly') {
  return db.transaction(stores, mode);
}

export function put(store, key, value) {
  return new Promise((resolve, reject) => {
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export function get(store, key) {
  return new Promise((resolve, reject) => {
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function del(store, key) {
  return new Promise((resolve, reject) => {
    const r = store.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export function clearAll(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction([STORE_META, STORE_HEADERS, STORE_TERMS, STORE_DOCS], 'readwrite');
    t.objectStore(STORE_META).clear();
    t.objectStore(STORE_HEADERS).clear();
    t.objectStore(STORE_TERMS).clear();
    t.objectStore(STORE_DOCS).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
