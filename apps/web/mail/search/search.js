// UI-side wrapper around the search worker plus the consent-gated server
// metadata search. Always returns merged ranked hits with per-hit source pills.

const REQUEST_TIMEOUT_MS = 6000;

export class LocalSearch {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.pending = new Map();
    this.nextRequestId = 1;
  }

  async start({ identityFingerprint, identitySearchSeed, identityArmoredPrivate, openpgpScriptUrl, workerScriptUrl }) {
    if (this.worker) {
      try { this.worker.terminate(); } catch (_) {}
    }
    this.worker = new Worker(workerScriptUrl || '/dist/mail-search-worker.js', { type: 'module' });
    this.worker.onmessage = (ev) => this.onMessage(ev);
    this.worker.onerror = (ev) => console.warn('search worker error', ev.message);
    await this.send({ kind: 'init', identityFingerprint, identitySearchSeed, identityArmoredPrivate, openpgpScriptUrl }, ['ready']);
    this.ready = true;
  }

  async indexMessage(messageId, blobUrl) {
    if (!this.worker) return;
    this.worker.postMessage({ kind: 'index', messageId, blobUrl });
  }

  cancel(messageId) {
    if (!this.worker) return;
    this.worker.postMessage({ kind: 'cancel', messageId });
  }

  async purge() {
    if (!this.worker) return;
    await this.send({ kind: 'purge' }, ['purged']);
  }

  async searchBody(q, limit = 25) {
    if (!this.worker || !this.ready) return [];
    const requestId = this.nextRequestId++;
    return await this.send({ kind: 'search', q, limit, requestId }, ['searchResult'], requestId);
  }

  async searchAll(q, opts = {}) {
    const { fields, limit = 50 } = opts;
    const tasks = [];
    if (q) {
      tasks.push(this.searchBody(q, limit).then((rows) => rows));
    }
    if (q && fields && fields.length > 0) {
      tasks.push(serverMetadataSearch(q, fields, limit).then((rows) => rows));
    }
    if (q && opts.headersFallback) {
      tasks.push(opts.headersFallback(q, limit));
    }
    const all = (await Promise.all(tasks)).flat();
    const seen = new Map();
    for (const row of all) {
      const id = row.message_id || row.id;
      if (!id) continue;
      const cur = seen.get(id);
      if (!cur) {
        seen.set(id, { ...row, sources: [row.source] });
      } else {
        cur.score = (cur.score || 0) + (row.score || 0);
        if (!cur.sources.includes(row.source)) cur.sources.push(row.source);
      }
    }
    return [...seen.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
  }

  send(msg, expectedKinds, requestId) {
    return new Promise((resolve, reject) => {
      const expected = new Set(expectedKinds);
      const id = requestId || (msg.requestId ?? this.nextRequestId++);
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('search worker timeout'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, expected, timer });
      this.worker.postMessage({ ...msg, requestId: id });
    });
  }

  onMessage(ev) {
    const data = ev.data || {};
    if (data.kind === 'indexed' || data.kind === 'error') {
      if (data.kind === 'error') console.warn('search worker', data.error, data.where);
      const ev2 = new CustomEvent('elvish-search-' + data.kind, { detail: data });
      try { window.dispatchEvent(ev2); } catch (_) {}
      return;
    }
    const id = data.requestId;
    if (!id || !this.pending.has(id)) return;
    const slot = this.pending.get(id);
    clearTimeout(slot.timer);
    this.pending.delete(id);
    if (data.kind === 'searchResult') slot.resolve(data.hits || []);
    else if (slot.expected.has(data.kind)) slot.resolve(data);
    else slot.reject(new Error(`unexpected kind ${data.kind}`));
  }
}

export async function serverMetadataSearch(q, fields, limit) {
  const apiOrigin =
    typeof elvishApiUrl === "function" ? elvishApiUrl("/") : window.location.origin;
  const u = new URL("/api/v1/mail/search/metadata", apiOrigin);
  u.searchParams.set('q', q);
  u.searchParams.set('fields', fields.join(','));
  u.searchParams.set('limit', String(limit));
  const resp = await fetch(u.toString(), { credentials: 'include' });
  if (!resp.ok) {
    if (resp.status === 400) return [];
    throw new Error(`metadata search ${resp.status}`);
  }
  const body = await resp.json();
  return (body.hits || []).map((h) => ({ ...h, message_id: h.id, score: 1, source: 'server-metadata' }));
}

window.ElvishLocalSearch = LocalSearch;
