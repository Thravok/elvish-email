// Web Worker that owns the local body index for one identity.
//
// Lifecycle:
//   1. UI posts {kind:'init', identityFingerprint, identitySearchSeed (Uint8Array)}.
//      Worker derives the AES-GCM index key (HKDF-SHA256, salt 'elvish-search-v1').
//   2. UI posts {kind:'index', messageId, blobUrl} for each manifest. Worker
//      fetches the PGP ciphertext from blobUrl, decrypts via openpgp.js (loaded
//      from the parent page via importScripts), strips MIME, tokenizes, and
//      writes encrypted postings + a snippet doc into IndexedDB.
//   3. UI posts {kind:'search', q, limit} and gets back ranked hits.
//   4. UI posts {kind:'purge'} to wipe the local index (e.g. on identity rotate
//      or when the user toggles indexing off in Settings → Search).
//
// Body content NEVER leaves the worker except as encrypted postings. The
// decrypted plaintext is zeroed in finally{} blocks before postMessage returns.

import {
  openDB,
  STORE_META,
  STORE_HEADERS,
  STORE_TERMS,
  STORE_DOCS,
  put,
  get,
  clearAll,
} from './db.js';
import { deriveIndexKey, sealJSON, openJSON } from './key.js';
import { tokenize, uniqueTerms } from './tokenize.js';

let db = null;
let indexKey = null;
let identityFingerprint = '';
let identityArmoredPrivate = '';
let openpgpReady = false;

const inflight = new Map(); // messageId → AbortController

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  try {
    switch (msg.kind) {
      case 'init':
        await handleInit(msg);
        self.postMessage({ kind: 'ready', identity: identityFingerprint });
        break;
      case 'index':
        await handleIndex(msg);
        break;
      case 'search':
        const hits = await handleSearch(msg);
        self.postMessage({ kind: 'searchResult', requestId: msg.requestId, hits });
        break;
      case 'cancel':
        if (inflight.has(msg.messageId)) {
          inflight.get(msg.messageId).abort();
          inflight.delete(msg.messageId);
        }
        break;
      case 'purge':
        if (db) await clearAll(db);
        self.postMessage({ kind: 'purged' });
        break;
      default:
        self.postMessage({ kind: 'error', error: `unknown kind: ${msg.kind}` });
    }
  } catch (err) {
    self.postMessage({ kind: 'error', error: String(err && err.message ? err.message : err), where: msg.kind });
  }
};

async function handleInit(msg) {
  if (!msg.identitySearchSeed || !(msg.identitySearchSeed instanceof Uint8Array)) {
    throw new Error('init requires identitySearchSeed');
  }
  identityFingerprint = msg.identityFingerprint || '';
  identityArmoredPrivate = msg.identityArmoredPrivate || '';
  indexKey = await deriveIndexKey(msg.identitySearchSeed);
  db = await openDB();
  if (!openpgpReady) {
    if (typeof openpgp !== 'undefined') {
      openpgpReady = true;
    } else if (msg.openpgpScriptUrl) {
      const scriptUrl = validateOpenpgpWorkerScriptUrl(msg.openpgpScriptUrl);
      importScripts(scriptUrl);
      openpgpReady = true;
    }
  }
  await writeMeta();
}

/** Same-origin .js URLs only (mitigates importScripts SSRF from postMessage). */
function validateOpenpgpWorkerScriptUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error('openpgp script url missing');
  }
  let u;
  try {
    u = new URL(s, self.location.href);
  } catch (_) {
    throw new Error('invalid openpgp script url');
  }
  if (u.origin !== new URL(self.location.href).origin) {
    throw new Error('openpgp script must be same-origin');
  }
  const pathname = u.pathname || '';
  if (!pathname.endsWith('.js')) {
    throw new Error('openpgp script must be a .js URL');
  }
  return u.href;
}

async function writeMeta() {
  const t = db.transaction([STORE_META], 'readwrite');
  await put(t.objectStore(STORE_META), 'v1', await sealJSON(indexKey, {
    schema_version: 1,
    identity_fingerprint: identityFingerprint,
    last_indexed_at: new Date().toISOString(),
  }));
  await new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function handleIndex(msg) {
  if (!db || !indexKey) throw new Error('worker not initialized');
  const messageId = String(msg.messageId || '');
  if (!messageId) return;
  const existingDoc = await get(db.transaction([STORE_DOCS], 'readonly').objectStore(STORE_DOCS), messageId);
  if (existingDoc) {
    self.postMessage({ kind: 'indexed', messageId, termCount: 0, cached: true, duration_ms: 0, fetch_ms: 0, decrypt_ms: 0, write_ms: 0 });
    return;
  }
  if (inflight.has(messageId)) inflight.get(messageId).abort();
  const ctl = new AbortController();
  inflight.set(messageId, ctl);
  let plaintext = null;
  const startedAt = Date.now();
  let fetchMS = 0;
  let decryptMS = 0;
  let writeMS = 0;
  try {
    const fetchStartedAt = Date.now();
    const resp = await fetch(msg.blobUrl, { credentials: 'include', signal: ctl.signal });
    if (!resp.ok) throw new Error(`blob fetch ${resp.status}`);
    const cipher = new Uint8Array(await resp.arrayBuffer());
    fetchMS = Date.now() - fetchStartedAt;
    const decryptStartedAt = Date.now();
    plaintext = await pgpDecrypt(cipher);
    decryptMS = Date.now() - decryptStartedAt;
    const text = mimeToText(plaintext);
    const tokens = tokenize(text);
    const terms = uniqueTerms(tokens);
    const writeStartedAt = Date.now();
    await writePostings(messageId, terms, text.slice(0, 240));
    writeMS = Date.now() - writeStartedAt;
    self.postMessage({
      kind: 'indexed',
      messageId,
      termCount: terms.length,
      duration_ms: Date.now() - startedAt,
      fetch_ms: fetchMS,
      decrypt_ms: decryptMS,
      write_ms: writeMS,
    });
  } finally {
    if (plaintext) plaintext.fill(0);
    inflight.delete(messageId);
  }
}

function looksLikeArmoredMessage(text) {
  return /^[\s\r\n\t]*-----BEGIN PGP (MESSAGE|SIGNED MESSAGE)-----/.test(text || '');
}

function extractArmoredBlock(text) {
  const match = String(text || '').match(/-----BEGIN PGP (?:MESSAGE|SIGNED MESSAGE)-----[\s\S]*?-----END PGP (?:MESSAGE|SIGNATURE)-----/);
  return match ? match[0].trim() : '';
}

function parseMimeHeaders(headerBlock) {
  const headers = {};
  let current = '';
  for (const line of String(headerBlock || '').split('\n')) {
    if (!line) return null;
    if (/^[ \t]/.test(line)) {
      if (!current) return null;
      headers[current] += ' ' + line.trim();
      continue;
    }
    const match = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!match) return null;
    current = match[1].toLowerCase();
    headers[current] = match[2];
  }
  return headers;
}

function base64ToBytes(raw) {
  const cleaned = String(raw || '').replace(/\s+/g, '');
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function quotedPrintableToBytes(raw) {
  const text = String(raw || '').replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(text.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(bytes);
}

function decodeTransferBytes(body, transferEncoding) {
  const encoding = String(transferEncoding || '').trim().toLowerCase();
  if (encoding === 'base64') return base64ToBytes(body);
  if (encoding === 'quoted-printable') return quotedPrintableToBytes(body);
  return new TextEncoder().encode(String(body || ''));
}

function extractPGPMimePayload(bytes) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes || new Uint8Array());
  const normalized = text.replace(/\r\n/g, '\n');
  const separatorIndex = normalized.indexOf('\n\n');
  if (separatorIndex <= 0) return null;
  const headers = parseMimeHeaders(normalized.slice(0, separatorIndex));
  if (!headers) return null;
  const contentType = String(headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary="?([^";\n]+)"?/i);
  if (!/multipart\/encrypted/i.test(contentType) || !boundaryMatch) return null;
  const boundary = `--${boundaryMatch[1]}`;
  const body = normalized.slice(separatorIndex + 2);
  for (const rawPart of body.split(boundary)) {
    let part = rawPart.trim();
    if (!part || part === '--') continue;
    if (part.endsWith('--')) part = part.slice(0, -2).trim();
    const partSeparator = part.indexOf('\n\n');
    if (partSeparator <= 0) continue;
    const partHeaders = parseMimeHeaders(part.slice(0, partSeparator));
    if (!partHeaders) continue;
    const partBody = part.slice(partSeparator + 2).replace(/^\n+|\n+$/g, '');
    const partType = String(partHeaders['content-type'] || '');
    if (/application\/pgp-encrypted/i.test(partType) && /version:\s*1/i.test(partBody)) {
      continue;
    }
    if (
      /application\/octet-stream/i.test(partType) ||
      /application\/pgp-encrypted/i.test(partType) ||
      looksLikeArmoredMessage(partBody)
    ) {
      const decoded = decodeTransferBytes(partBody, partHeaders['content-transfer-encoding']);
      const armored = extractArmoredBlock(new TextDecoder('utf-8', { fatal: false }).decode(decoded));
      return armored ? new TextEncoder().encode(armored) : decoded;
    }
  }
  return null;
}

async function readEncryptedMessage(cipher) {
  const bytes = cipher instanceof Uint8Array ? cipher : new Uint8Array(cipher || []);
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 160)));
  if (looksLikeArmoredMessage(prefix)) {
    return openpgp.readMessage({ armoredMessage: new TextDecoder().decode(bytes) });
  }
  const fullText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const embeddedArmored = extractArmoredBlock(fullText);
  if (embeddedArmored) {
    return openpgp.readMessage({ armoredMessage: embeddedArmored });
  }
  const pgpMimePayload = extractPGPMimePayload(bytes);
  if (pgpMimePayload && pgpMimePayload.length > 0) {
    const payloadText = new TextDecoder().decode(pgpMimePayload);
    const armored = extractArmoredBlock(payloadText);
    if (armored) {
      return openpgp.readMessage({ armoredMessage: armored });
    }
    return openpgp.readMessage({ binaryMessage: pgpMimePayload });
  }
  return openpgp.readMessage({ binaryMessage: bytes });
}

async function pgpDecrypt(cipher) {
  if (!openpgpReady || typeof openpgp === 'undefined') {
    throw new Error('openpgp.js not loaded');
  }
  const message = await readEncryptedMessage(cipher);
  const privKey = await openpgp.readPrivateKey({ armoredKey: identityArmoredPrivate });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: [privKey], format: 'binary' });
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function mimeToText(bytes) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const sep = text.indexOf('\r\n\r\n');
  let body = sep > 0 ? text.slice(sep + 4) : text;
  const sigStart = body.indexOf('-----BEGIN PGP SIGNATURE-----');
  if (sigStart >= 0) body = body.slice(0, sigStart);
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function writePostings(messageId, terms, snippet) {
  const t = db.transaction([STORE_TERMS, STORE_DOCS], 'readwrite');
  const termsStore = t.objectStore(STORE_TERMS);
  const docsStore = t.objectStore(STORE_DOCS);
  for (const { term, tf, positions } of terms) {
    const existing = await get(termsStore, term);
    const open = existing ? await openJSON(indexKey, existing) : null;
    const merged = open || { term, df: 0, postings: [] };
    const oldIdx = merged.postings.findIndex((p) => p.message_id === messageId);
    if (oldIdx >= 0) merged.postings.splice(oldIdx, 1);
    else merged.df += 1;
    merged.postings.push({ message_id: messageId, tf, positions });
    await put(termsStore, term, await sealJSON(indexKey, merged));
  }
  await put(docsStore, messageId, await sealJSON(indexKey, {
    indexed_at: new Date().toISOString(),
    term_count: terms.length,
    snippet,
  }));
  await new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function handleSearch(msg) {
  if (!db || !indexKey) throw new Error('worker not initialized');
  const q = String(msg.q || '').trim();
  if (!q) return [];
  const limit = Math.max(1, Math.min(100, Number(msg.limit) || 25));
  const queryTerms = uniqueTerms(tokenize(q));
  if (queryTerms.length === 0) return [];
  const t = db.transaction([STORE_TERMS, STORE_DOCS], 'readonly');
  const termsStore = t.objectStore(STORE_TERMS);
  const docsStore = t.objectStore(STORE_DOCS);
  const N = await countDocs(docsStore);
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = await averageDocLength(docsStore);
  const scores = new Map();
  for (const { term } of queryTerms) {
    const env = await get(termsStore, term);
    if (!env) continue;
    const opened = await openJSON(indexKey, env);
    if (!opened) continue;
    const idf = Math.log(1 + (N - opened.df + 0.5) / (opened.df + 0.5));
    for (const p of opened.postings) {
      const docEnv = await get(docsStore, p.message_id);
      const doc = docEnv ? await openJSON(indexKey, docEnv) : null;
      const dl = doc ? doc.term_count || 0 : 0;
      const norm = 1 - b + (b * dl) / Math.max(1, avgdl);
      const tfWeight = (p.tf * (k1 + 1)) / (p.tf + k1 * norm);
      const inc = idf * tfWeight;
      scores.set(p.message_id, (scores.get(p.message_id) || 0) + inc);
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const hits = [];
  for (const [messageId, score] of ranked) {
    const env = await get(docsStore, messageId);
    const doc = env ? await openJSON(indexKey, env) : null;
    hits.push({
      message_id: messageId,
      score,
      snippet: doc ? doc.snippet : '',
      indexed_at: doc ? doc.indexed_at : null,
      source: 'local-body',
    });
  }
  return hits;
}

async function countDocs(store) {
  return await new Promise((resolve, reject) => {
    const r = store.count();
    r.onsuccess = () => resolve(r.result || 0);
    r.onerror = () => reject(r.error);
  });
}

async function averageDocLength(store) {
  let total = 0;
  let n = 0;
  await new Promise((resolve, reject) => {
    const r = store.openCursor();
    r.onsuccess = async () => {
      const cur = r.result;
      if (!cur) return resolve();
      const doc = await openJSON(indexKey, cur.value);
      if (doc && typeof doc.term_count === 'number') {
        total += doc.term_count;
        n += 1;
      }
      cur.continue();
    };
    r.onerror = () => reject(r.error);
  });
  return n === 0 ? 1 : total / n;
}
