// Manifest-model client for /api/v1/mail/messages.
//
// Each manifest carries the per-message PGP-encrypted header (client decrypt).
// The server may also store a sparse plaintext projection of common header
// fields for listing, search, and threading (opt-in metadata in Scylla).
//
// The body is NEVER returned in /messages — it lives in object storage and is
// fetched lazily via /messages/{id}/blob when the user opens a thread.

const API = '/api/v1/mail';

export async function fetchManifests(folder = 'inbox', { limit = 50, before } = {}) {
  const u = new URL(API + '/messages', window.location.origin);
  u.searchParams.set('folder', folder);
  u.searchParams.set('limit', String(limit));
  if (before) u.searchParams.set('before', before);
  const resp = await fetch(u.toString(), { credentials: 'include' });
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    const detail = typeof j.error === "string" && j.error ? j.error : "";
    throw new Error(`mail messages ${resp.status}${detail ? ": " + detail : ""}`);
  }
  return resp.json();
}

export async function fetchManifest(id) {
  const resp = await fetch(`${API}/messages/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`mail manifest ${resp.status}`);
  return resp.json();
}

export async function fetchBlob(id) {
  const resp = await fetch(`${API}/messages/${encodeURIComponent(id)}/blob`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`mail blob ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

export async function setMessageRead(id, read = true) {
  const resp = await fetch(`${API}/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ read: !!read }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `mail patch ${resp.status}`);
  }
  return resp.json();
}

export async function moveMessage(id, folder) {
  const resp = await fetch(`${API}/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `mail move ${resp.status}`);
  }
  return resp.json();
}

export async function refreshMessageHeader(id, headerCiphertextB64) {
  const resp = await fetch(`${API}/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ header_ciphertext_b64: headerCiphertextB64 }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `mail header refresh ${resp.status}`);
  }
  return resp.json();
}

export async function deleteMessage(id, { permanent = false } = {}) {
  const u = new URL(`${API}/messages/${encodeURIComponent(id)}`, window.location.origin);
  if (permanent) u.searchParams.set('mode', 'permanent');
  const resp = await fetch(u.toString(), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `mail delete ${resp.status}`);
  }
  return resp.json();
}

export async function postEncryptedMessage({
  recipient,
  headerCiphertextB64,
  bodyCiphertextB64,
  senderHeaderCiphertextB64,
  senderBodyCiphertextB64,
  fromAddr,
  toAddrs,
}) {
  const resp = await fetch(`${API}/messages`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient,
      header_ciphertext_b64: headerCiphertextB64,
      body_ciphertext_b64: bodyCiphertextB64,
      sender_header_ciphertext_b64: senderHeaderCiphertextB64 || '',
      sender_body_ciphertext_b64: senderBodyCiphertextB64 || '',
      from_addr: fromAddr || null,
      to_addrs: toAddrs || [],
    }),
  });
  if (!resp.ok) throw new Error(`mail post ${resp.status}`);
  return resp.json();
}

export async function postOutbox({ payloadCiphertextB64, recipientSummary, senderHeaderCiphertextB64, senderBodyCiphertextB64, fromAddr }) {
  const resp = await fetch(`${API}/outbox`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      payload_ciphertext_b64: payloadCiphertextB64,
      recipient_summary: recipientSummary || [],
      sender_header_ciphertext_b64: senderHeaderCiphertextB64 || '',
      sender_body_ciphertext_b64: senderBodyCiphertextB64 || '',
      from_addr: fromAddr || '',
    }),
  });
  if (!resp.ok) throw new Error(`mail outbox ${resp.status}`);
  return resp.json();
}

export async function getOutbox(id) {
  const resp = await fetch(`${API}/outbox/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`outbox get ${resp.status}`);
  return resp.json();
}

export async function getMailSettings() {
  const resp = await fetch(`${API}/settings`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`mail settings ${resp.status}`);
  return resp.json();
}

export async function setMailSettings(body) {
  const resp = await fetch(`${API}/settings`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `mail settings save ${resp.status}`);
  }
  return resp.json();
}

export async function lookupKey(email) {
  const u = new URL('/api/v1/keys/lookup', window.location.origin);
  u.searchParams.set('email', email);
  const resp = await fetch(u.toString(), { credentials: 'include' });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`keys lookup ${resp.status}`);
  const hit = await resp.json();
  if (hit && typeof hit === 'object') {
    if (hit.armored && !hit.armored_public) hit.armored_public = hit.armored;
    if (hit.armored_public && !hit.armored) hit.armored = hit.armored_public;
  }
  return hit;
}

export async function listIdentities() {
  const resp = await fetch('/api/v1/identities', { credentials: 'include' });
  if (!resp.ok) throw new Error(`identities list ${resp.status}`);
  return resp.json();
}

export async function setDefaultIdentity(fingerprint) {
  const resp = await fetch(`/api/v1/identities/${encodeURIComponent(fingerprint)}/default`, {
    method: 'POST', credentials: 'include',
  });
  if (!resp.ok) throw new Error(`identity default ${resp.status}`);
  return resp.json();
}

export async function deleteIdentity(fingerprint) {
  const resp = await fetch(`/api/v1/identities/${encodeURIComponent(fingerprint)}`, {
    method: 'DELETE', credentials: 'include',
  });
  if (!resp.ok) throw new Error(`identity delete ${resp.status}`);
  return resp.json();
}

export async function updateIdentityProfile(fingerprint, payload) {
  const resp = await fetch(`/api/v1/identities/${encodeURIComponent(fingerprint)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `identity update ${resp.status}`);
  }
  return resp.json();
}

export async function lookupVisibleIdentityProfile(email) {
  const u = new URL('/api/v1/identities/visible-profile', window.location.origin);
  u.searchParams.set('email', String(email || '').trim());
  const resp = await fetch(u.toString(), { credentials: 'include' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `identity visible profile ${resp.status}`);
  }
  return resp.json();
}

// decryptHeaderCiphertext returns the decrypted JSON header stub (or null on failure).
// vault is window.ElvishKeyVault, the unlocked KeyVault from auth/unlock.js.
export async function decryptHeader(vault, headerCiphertextB64, identityFingerprint) {
  if (!headerCiphertextB64 || !vault) return null;
  try {
    const cipher = base64ToBytes(headerCiphertextB64);
    const text = await vault.decryptForIdentity(identityFingerprint, cipher);
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function base64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

// postOutboxPlain submits a plaintext outbound message. Server wraps the RFC 5322
// message with the operator-configured relay key so the blob store never sees
// cleartext. Worker decrypts in memory just before SMTP DATA.
export async function postOutboxPlain({ fromAddr, toAddrs, subject, bodyText }) {
  const resp = await fetch(`${API}/outbox-plain`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      from_addr: fromAddr,
      to_addrs: toAddrs || [],
      subject: subject || '',
      body_text: bodyText || '',
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `outbox-plain ${resp.status}`);
  }
  return resp.json();
}

// createProtectedLink uploads a sender-encrypted payload + KDF parameters and
// returns the public URL. The password never leaves the browser.
export async function createProtectedLink(body) {
  const resp = await fetch(`${API}/protected-links`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `protected-links ${resp.status}`);
  }
  return resp.json();
}

// Address book — per-user saved / trusted OpenPGP public keys (not the global resolver cache).
export async function getContactKey(email) {
  const resp = await fetch(`/api/v1/keys/contacts/${encodeURIComponent(email)}`, { credentials: 'include' });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`contacts get ${resp.status}`);
  return resp.json();
}

/** @param {{ email: string, armoredPublic: string, source?: string, trusted?: boolean }} opts — trusted defaults true */
export async function putContactKey({ email, armoredPublic, source, trusted }) {
  const body = { email, armored_public: armoredPublic, source: source || 'manual' };
  if (trusted === false) body.trusted = false;
  if (trusted === true) body.trusted = true;
  const resp = await fetch('/api/v1/keys/contacts', {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `contacts put ${resp.status}`);
  }
  return resp.json();
}

export async function deleteContactKey(email, fingerprint) {
  const q = fingerprint ? `?fingerprint=${encodeURIComponent(fingerprint)}` : '';
  const resp = await fetch(`/api/v1/keys/contacts/${encodeURIComponent(email)}${q}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `contacts delete ${resp.status}`);
  }
  return resp.json();
}

export async function listContactKeys(opts) {
  const q = opts && opts.trustedOnly ? '?trusted=1' : '';
  const resp = await fetch(`/api/v1/keys/contacts${q}`, { credentials: 'include' });
  if (!resp.ok) throw new Error(`contacts list ${resp.status}`);
  return resp.json();
}

export async function changePassword(currentPassword, newPassword) {
  const meRes = await fetch('/api/v1/account-key/me', { credentials: 'include' });
  if (!meRes.ok) throw new Error(`account key ${meRes.status}`);
  const me = await meRes.json();
  const authRes = await fetch('/api/auth/me', { credentials: 'include' });
  if (!authRes.ok) throw new Error(`auth me ${authRes.status}`);
  const auth = await authRes.json();
  const username = auth && auth.user && auth.user.username;
  if (!username) throw new Error('missing auth username');
  if (!window.ElvishKeygen || !window.ElvishKeygen.rewrapAccountForNewPassword) {
    throw new Error('crypto not loaded');
  }
  if (!window.ElvishSRP) throw new Error('SRP not loaded');
  const ak = await window.ElvishKeygen.rewrapAccountForNewPassword(me, currentPassword, newPassword);
  const srp = await window.ElvishSRP.createRegistration(username, newPassword);
  return await window.ElvishSRP.exchange('/api/auth/password/begin', '/api/auth/password/finish', username, currentPassword, {
    new_srp_salt_b64: srp.srp_salt_b64,
    new_srp_verifier_b64: srp.srp_verifier_b64,
    new_srp_group: srp.srp_group,
    new_srp_hash: srp.srp_hash,
    account_key: {
      wrapped_secret_b64: ak.wrapped_secret_b64,
      kdf: ak.kdf,
      kdf_salt_b64: ak.kdf_salt_b64,
      kdf_params_json: ak.kdf_params_json,
    },
  });
}

async function runAccountDeleteAction(password, confirmation, finishPath) {
  const authRes = await fetch('/api/auth/me', { credentials: 'include' });
  if (!authRes.ok) throw new Error(`auth me ${authRes.status}`);
  const auth = await authRes.json();
  const username = auth && auth.user && auth.user.username;
  if (!username) throw new Error('missing auth username');
  if (!window.ElvishSRP) throw new Error('SRP not loaded');
  return await window.ElvishSRP.exchange('/api/auth/account-delete/begin', finishPath, username, password, {
    confirmation,
  });
}

export async function deleteAccount(password, confirmation) {
  return runAccountDeleteAction(password, confirmation, '/api/auth/account-delete/now');
}

export async function scheduleAccountDeletion(password, confirmation) {
  return runAccountDeleteAction(password, confirmation, '/api/auth/account-delete/schedule');
}

export async function cancelAccountDeletion() {
  const resp = await fetch('/api/auth/account-delete/cancel', {
    method: 'POST',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `account delete cancel ${resp.status}`);
  return body;
}

export async function getDeletePolicy() {
  const resp = await fetch('/api/v1/account/delete-policy', { credentials: 'include' });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `delete policy ${resp.status}`);
  return body;
}

export async function setDeletePolicy(payload) {
  const resp = await fetch('/api/v1/account/delete-policy', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `delete policy save ${resp.status}`);
  return body;
}

export async function getBillingStatus() {
  const resp = await fetch('/api/v1/billing/status', { credentials: 'include' });
  if (!resp.ok) throw new Error(`billing ${resp.status}`);
  return resp.json();
}

export async function createIdentity(payload) {
  const resp = await fetch('/api/v1/identities', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `identity create ${resp.status}`);
  }
  return resp.json();
}

function parseAccountAddress(accountEmail) {
  const email = String(accountEmail || '').trim().toLowerCase();
  const at = email.indexOf('@');
  const localPart = at > 0 ? email.slice(0, at) : '';
  const domain = at > 0 ? email.slice(at + 1) : '';
  if (!localPart || !domain) throw new Error('Invalid account email');
  return { localPart, domain };
}

function resolveIdentityDomain({ domain, accountEmail }) {
  let d = String(domain || '').trim().toLowerCase();
  if (d) return d;
  try {
    const { domain: ad } = parseAccountAddress(accountEmail);
    if (ad) return ad;
  } catch (_) {
    /* fall through */
  }
  throw new Error('Choose a mail domain');
}

function validateMailboxLocalPartForIdentity(local) {
  const s = String(local || '').trim().toLowerCase();
  if (s.length < 3 || s.length > 64) {
    throw new Error('Local part must be 3-64 characters');
  }
  if (s.includes('..')) throw new Error('Local part cannot contain consecutive dots');
  if (s.startsWith('.') || s.endsWith('.')) {
    throw new Error('Local part cannot start or end with a dot');
  }
  if (!/^[a-z0-9._-]+$/.test(s)) {
    throw new Error('Use only letters, digits, dots, hyphens, and underscores in the local part');
  }
  return s;
}

function validatePlusTagFromName(name) {
  const tag = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  if (!tag) throw new Error('Plus tag required (letters, digits, hyphens, underscores)');
  return tag;
}

function buildGeneratedIdentityAddress({ type, domain, localPart, name }) {
  const dom = String(domain || '').trim().toLowerCase();
  if (!dom) throw new Error('Choose a domain');
  if (type === 'alias') {
    const local = validateMailboxLocalPartForIdentity(localPart);
    return { email: `${local}@${dom}`, expiresAt: '' };
  }
  if (type === 'plus') {
    const base = validateMailboxLocalPartForIdentity(localPart);
    const tag = validatePlusTagFromName(name);
    return { email: `${base}+${tag}@${dom}`, expiresAt: '' };
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 14; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return {
    email: `d_${rand}@${dom}`,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
}

export async function createGeneratedIdentity({
  accountEmail = '',
  type = 'disposable',
  name = '',
  domain: domainOpt = '',
  localPart = '',
}) {
  if (!window.openpgp || !window.ElvishKeygen) {
    throw new Error('OpenPGP / keygen not loaded - refresh the page');
  }
  const meRes = await fetch('/api/v1/account-key/me', { credentials: 'include' });
  if (!meRes.ok) throw new Error(`Could not load account key (${meRes.status})`);
  const me = await meRes.json();
  if (!me.bootstrapped) {
    throw new Error('Generate or unlock account keys first (unlock mail)');
  }
  const domain = resolveIdentityDomain({ domain: domainOpt, accountEmail });
  let lp = localPart;
  if (type === 'plus' && !String(lp || '').trim()) {
    try {
      lp = parseAccountAddress(accountEmail).localPart;
    } catch (_) {
      throw new Error('Local part (before +) is required for plus addresses');
    }
  }
  const { email, expiresAt } = buildGeneratedIdentityAddress({
    type,
    domain,
    localPart: lp,
    name,
  });
  const idKp = await window.openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: email, email }],
    format: 'armored',
  });
  const wrappedArmored = await window.ElvishKeygen.pgpWrapToAccount(idKp.privateKey, me.armored_public);
  const wrappedB64 = window.ElvishKeygen.bytesToB64(new TextEncoder().encode(wrappedArmored));
  const payload = {
    email,
    armored_public: idKp.publicKey,
    algorithm: 'openpgp-ecc-curve25519',
    primary_uid: email,
    wrapped_secret_b64: wrappedB64,
    is_default: false,
  };
  if (expiresAt) payload.expires_at = expiresAt;
  const result = await createIdentity(payload);
  return { ...result, email, expires_at: expiresAt || null };
}

export async function listMailboxFolders() {
  const resp = await fetch('/api/v1/mailbox/folders', { credentials: 'include' });
  if (!resp.ok) throw new Error(`folders ${resp.status}`);
  return resp.json();
}

export async function createMailboxFolder(name) {
  const resp = await fetch('/api/v1/mailbox/folders', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `folder create ${resp.status}`);
  }
  return resp.json();
}

export async function deleteMailboxFolder(name) {
  const resp = await fetch(`/api/v1/mailbox/folders/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `folder delete ${resp.status}`);
  }
  return resp.json();
}

export async function listFilters() {
  const resp = await fetch('/api/v1/filters', { credentials: 'include' });
  if (!resp.ok) throw new Error(`filters ${resp.status}`);
  return resp.json();
}

export async function createFilter(body) {
  const resp = await fetch('/api/v1/filters', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `filter create ${resp.status}`);
  }
  return resp.json();
}

export async function updateFilter(id, body) {
  const resp = await fetch(`/api/v1/filters/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `filter update ${resp.status}`);
  }
  return resp.json();
}

export async function deleteFilter(id) {
  const resp = await fetch(`/api/v1/filters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `filter delete ${resp.status}`);
  }
  return resp.json();
}

export async function listCustomDomains() {
  const resp = await fetch('/api/v1/custom-domains', { credentials: 'include' });
  if (!resp.ok) throw new Error(`domains ${resp.status}`);
  return resp.json();
}

/** Domains the current user may use for new identities (host + owned + operator-shared). */
export async function listUsableDomains() {
  const resp = await fetch('/api/v1/mail/usable-domains', { credentials: 'include' });
  if (!resp.ok) throw new Error(`usable-domains ${resp.status}`);
  return resp.json();
}

export async function addCustomDomain(domain) {
  const resp = await fetch('/api/v1/custom-domains', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `domain add ${resp.status}`);
  }
  return resp.json();
}

export async function deleteCustomDomain(domain) {
  const resp = await fetch(`/api/v1/custom-domains/${encodeURIComponent(domain)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `domain delete ${resp.status}`);
  }
  return resp.json();
}

export async function verifyCustomDomain(domain) {
  const resp = await fetch(`/api/v1/custom-domains/${encodeURIComponent(domain)}/verify`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `domain verify ${resp.status}`);
  }
  return resp.json();
}

export async function setDomainCatchall(domain, identityFingerprint) {
  const body = identityFingerprint == null || identityFingerprint === ''
    ? { identity_fingerprint: null }
    : { identity_fingerprint: identityFingerprint };
  const resp = await fetch(`/api/v1/custom-domains/${encodeURIComponent(domain)}/catchall`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `catchall ${resp.status}`);
  }
  return resp.json();
}

export async function listSMTPCredentials() {
  const resp = await fetch('/api/v1/smtp-submission', { credentials: 'include' });
  if (!resp.ok) throw new Error(`smtp list ${resp.status}`);
  return resp.json();
}

export async function createSMTPCredential(body) {
  const resp = await fetch('/api/v1/smtp-submission', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `smtp create ${resp.status}`);
  }
  return resp.json();
}

export async function regenerateSMTPCredential(id) {
  const resp = await fetch(`/api/v1/smtp-submission/${encodeURIComponent(id)}/regenerate`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `smtp regenerate ${resp.status}`);
  }
  return resp.json();
}

export async function deleteSMTPCredential(id) {
  const resp = await fetch(`/api/v1/smtp-submission/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `smtp delete ${resp.status}`);
  }
  return resp.json();
}

export async function getTwoFactorStatus() {
  const resp = await fetch('/api/auth/2fa', { credentials: 'include' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `2fa status ${resp.status}`);
  }
  return resp.json();
}

export async function beginTOTPSetup(label) {
  const resp = await fetch('/api/auth/2fa/totp/begin', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: label || '' }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `totp begin ${resp.status}`);
  return body;
}

export async function confirmTOTPSetup(setupId, code) {
  const resp = await fetch('/api/auth/2fa/totp/confirm', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ setup_id: setupId, code }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `totp confirm ${resp.status}`);
  return body;
}

export async function verifyTwoFactorTOTP(code) {
  const resp = await fetch('/api/auth/2fa/verify/totp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `totp verify ${resp.status}`);
  return body;
}

export async function verifyTwoFactorRecovery(code) {
  const resp = await fetch('/api/auth/2fa/verify/recovery', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `recovery verify ${resp.status}`);
  return body;
}

export async function regenerateRecoveryCodes() {
  const resp = await fetch('/api/auth/2fa/recovery/regenerate', {
    method: 'POST',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `recovery regenerate ${resp.status}`);
  return body;
}

export async function beginWebAuthnRegistration() {
  const resp = await fetch('/api/auth/2fa/webauthn/register/begin', {
    method: 'POST',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `webauthn begin register ${resp.status}`);
  return body;
}

export async function finishWebAuthnRegistration(challengeId, credential, label) {
  const resp = await fetch('/api/auth/2fa/webauthn/register/finish', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challenge_id: challengeId, credential, label: label || '' }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `webauthn finish register ${resp.status}`);
  return body;
}

export async function beginWebAuthnVerification() {
  const resp = await fetch('/api/auth/2fa/verify/webauthn/begin', {
    method: 'POST',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `webauthn begin verify ${resp.status}`);
  return body;
}

export async function finishWebAuthnVerification(challengeId, credential) {
  const resp = await fetch('/api/auth/2fa/verify/webauthn/finish', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challenge_id: challengeId, credential }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `webauthn finish verify ${resp.status}`);
  return body;
}

export async function deleteTOTPFactor(id) {
  const resp = await fetch(`/api/auth/2fa/totp/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `totp delete ${resp.status}`);
  return body;
}

export async function deleteWebAuthnCredential(id) {
  const resp = await fetch(`/api/auth/2fa/webauthn/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `webauthn delete ${resp.status}`);
  return body;
}

window.ElvishMailManifest = {
  fetchManifests, fetchManifest, fetchBlob, setMessageRead, moveMessage, refreshMessageHeader, deleteMessage, postEncryptedMessage, postOutbox,
  postOutboxPlain, createProtectedLink,
  getOutbox, getMailSettings, setMailSettings, lookupKey,
  listIdentities, setDefaultIdentity, deleteIdentity, updateIdentityProfile, lookupVisibleIdentityProfile, decryptHeader,
  getContactKey, putContactKey, listContactKeys, deleteContactKey,
  base64ToBytes, bytesToBase64,
  changePassword, deleteAccount, scheduleAccountDeletion, cancelAccountDeletion, getDeletePolicy, setDeletePolicy, getBillingStatus,
  createIdentity, createGeneratedIdentity,
  listMailboxFolders, createMailboxFolder, deleteMailboxFolder,
  listFilters, createFilter, updateFilter, deleteFilter,
  listCustomDomains, listUsableDomains, addCustomDomain, deleteCustomDomain, verifyCustomDomain, setDomainCatchall,
  listSMTPCredentials, createSMTPCredential, regenerateSMTPCredential, deleteSMTPCredential,
  getTwoFactorStatus, beginTOTPSetup, confirmTOTPSetup,
  verifyTwoFactorTOTP, verifyTwoFactorRecovery, regenerateRecoveryCodes,
  beginWebAuthnRegistration, finishWebAuthnRegistration,
  beginWebAuthnVerification, finishWebAuthnVerification,
  deleteTOTPFactor, deleteWebAuthnCredential,
};
