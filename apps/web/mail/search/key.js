// Per-identity AES-GCM index key derivation via HKDF-SHA256.
//
// The input keying material is a stable search seed derived from the unlocked
// identity material, but it is intentionally NOT tied to OpenPGP private-key
// internals such as subkey scalar layouts.

const SALT_V1 = new TextEncoder().encode('elvish-search-v1');
const INFO = new TextEncoder().encode('search');

export async function deriveIndexKey(identitySearchSeed) {
  return deriveScopedKey(identitySearchSeed, SALT_V1, INFO);
}

export async function deriveScopedKey(seedBytes, saltBytes, infoBytes) {
  if (!(seedBytes instanceof Uint8Array) || seedBytes.length === 0) {
    throw new Error('search/key: empty seed');
  }
  const salt = saltBytes instanceof Uint8Array ? saltBytes : new TextEncoder().encode(String(saltBytes || ''));
  const info = infoBytes instanceof Uint8Array ? infoBytes : new TextEncoder().encode(String(infoBytes || ''));
  const ikm = await crypto.subtle.importKey('raw', seedBytes, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return key;
}

export async function deriveScopedKeyFromLabel(seedBytes, label) {
  const labelBytes = label instanceof Uint8Array ? label : new TextEncoder().encode(String(label || ''));
  return deriveScopedKey(seedBytes, labelBytes, labelBytes);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sealJSON(key, value) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext);
  return { nonce_b64: b64encode(nonce), ciphertext_b64: b64encode(new Uint8Array(ct)) };
}

export async function openJSON(key, envelope) {
  if (!envelope || typeof envelope.nonce_b64 !== 'string' || typeof envelope.ciphertext_b64 !== 'string') {
    return null;
  }
  const nonce = b64decode(envelope.nonce_b64);
  const ct = b64decode(envelope.ciphertext_b64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct);
  return JSON.parse(dec.decode(new Uint8Array(pt)));
}
