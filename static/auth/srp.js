// ELVISH SRP-6a browser helper.
(function () {
  const GROUP_NAME = "rfc5054-2048";
  const HASH_NAME = "sha256";
  const N_HEX = "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6096BEECFB71744F9A5B7CDBD7B3E8C94BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";
  const N = BigInt("0x" + N_HEX);
  const G = 2n;
  const PAD_LEN = Math.ceil(N_HEX.length / 2);

  function utf8(s) { return new TextEncoder().encode(String(s == null ? "" : s)); }
  function concatBytes(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
  }
  async function sha256(...parts) {
    const buf = await crypto.subtle.digest("SHA-256", concatBytes(parts));
    return new Uint8Array(buf);
  }
  function bytesToB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const bin = atob(String(b64 || ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToBigInt(bytes) {
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return BigInt("0x" + (hex || "00"));
  }
  function bigIntToBytes(num, padLen) {
    let hex = num.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const raw = new Uint8Array(hex.length / 2);
    for (let i = 0; i < raw.length; i++) raw[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!padLen || raw.length >= padLen) return raw;
    const out = new Uint8Array(padLen);
    out.set(raw, padLen - raw.length);
    return out;
  }
  function randomBytes(n) {
    const out = new Uint8Array(n);
    crypto.getRandomValues(out);
    return out;
  }
  function modPow(base, exp, mod) {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
      if (e & 1n) result = (result * b) % mod;
      e >>= 1n;
      b = (b * b) % mod;
    }
    return result;
  }
  async function multiplier() {
    return bytesToBigInt(await sha256(bigIntToBytes(N, PAD_LEN), bigIntToBytes(G, PAD_LEN)));
  }
  async function computeX(username, password, saltBytes) {
    const inner = await sha256(utf8(username + ":" + password));
    return bytesToBigInt(await sha256(saltBytes, inner));
  }
  async function createRegistration(username, password) {
    const salt = randomBytes(16);
    const x = await computeX(username, password, salt);
    const verifier = modPow(G, x, N);
    return {
      srp_salt_b64: bytesToB64(salt),
      srp_verifier_b64: bytesToB64(bigIntToBytes(verifier, PAD_LEN)),
      srp_group: GROUP_NAME,
      srp_hash: HASH_NAME,
    };
  }
  async function begin(username, password) {
    const a = bytesToBigInt(randomBytes(32));
    const A = modPow(G, a, N);
    return {
      username,
      password,
      a,
      A,
      client_public_b64: bytesToB64(bigIntToBytes(A, PAD_LEN)),
    };
  }
  async function clientProof(state, saltBytes, serverPublicBytes) {
    const B = bytesToBigInt(serverPublicBytes);
    const A = state.A;
    const k = await multiplier();
    const u = bytesToBigInt(await sha256(bigIntToBytes(A, PAD_LEN), bigIntToBytes(B, PAD_LEN)));
    const x = await computeX(state.username, state.password, saltBytes);
    const gx = modPow(G, x, N);
    let base = (B - (k * gx)) % N;
    if (base < 0n) base += N;
    const exp = state.a + (u * x);
    const S = modPow(base, exp, N);
    const K = await sha256(bigIntToBytes(S, PAD_LEN));
    const hN = await sha256(bigIntToBytes(N, PAD_LEN));
    const hG = await sha256(bigIntToBytes(G, PAD_LEN));
    const xor = new Uint8Array(hN.length);
    for (let i = 0; i < hN.length; i++) xor[i] = hN[i] ^ hG[i];
    const M1 = await sha256(xor, await sha256(utf8(state.username)), saltBytes, bigIntToBytes(A, PAD_LEN), bigIntToBytes(B, PAD_LEN), K);
    const M2 = await sha256(bigIntToBytes(A), M1, K);
    return { client_proof_b64: bytesToB64(M1), expected_server_proof_b64: bytesToB64(M2) };
  }
  async function exchange(beginUrl, finishUrl, username, password, extraFinishPayload, extraBeginPayload) {
    const state = await begin(username, password);
    const beginRes = await fetch(beginUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        Object.assign({}, extraBeginPayload || {}, {
          username,
          client_public_b64: state.client_public_b64,
          company: "",
        })
      ),
    });
    const beginJSON = await beginRes.json().catch(() => ({}));
    if (!beginRes.ok) throw new Error(beginJSON.error || "SRP begin failed");
    const proof = await clientProof(state, b64ToBytes(beginJSON.salt_b64), b64ToBytes(beginJSON.server_public_b64));
    const finishRes = await fetch(finishUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, extraFinishPayload || {}, {
        session_id: beginJSON.session_id,
        client_proof_b64: proof.client_proof_b64,
        company: "",
      })),
    });
    const finishJSON = await finishRes.json().catch(() => ({}));
    if (!finishRes.ok) throw new Error(finishJSON.error || "SRP finish failed");
    if (proof.expected_server_proof_b64 && finishJSON.server_proof_b64 && proof.expected_server_proof_b64 !== finishJSON.server_proof_b64) {
      throw new Error("SRP server proof mismatch");
    }
    return finishJSON;
  }

  globalThis.ElvishSRP = {
    GROUP_NAME,
    HASH_NAME,
    createRegistration,
    exchange,
  };
})();
