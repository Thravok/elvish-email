// ELVISH — client-side key hierarchy bootstrap (Skiff-style two-layer model).
//
// Layer 1: account key. PGP keypair whose private half is wrapped (AES-256-GCM)
//          by a KEK derived from the user's password. New rows prefer Argon2id;
//          legacy rows may still use PBKDF2-SHA256 and remain readable.
//          The server only ever sees the wrapped private bytes + KDF params.
//
// Layer 2: identity key. One PGP keypair per email. The private half is wrapped
//          (PGP-encrypted) to the account public key, so unlocking the account
//          key unlocks all identities.
//
// All key material lives in the browser only. The server stores opaque blobs.

(function () {
  const KDF_ARGON2ID = "argon2id";
  /** Stored/sent KDF label (iteration count lives in kdf_params_json). */
  const KDF_PBKDF2 = "pbkdf2-sha256";
  const KDF_PBKDF2_LEGACY = "pbkdf2-sha256-600k";

  function isPbkdf2Sha256Kdf(hint) {
    return hint === KDF_PBKDF2 || hint === KDF_PBKDF2_LEGACY;
  }
  const PBKDF2_ITERATIONS = 600000;
  const ARGON2_TIME = 3;
  const ARGON2_MEM_KIB = 64 * 1024;
  const ARGON2_PARALLELISM = 1;
  const KEK_BYTES = 32;

  function bytesToB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8(s) {
    return new TextEncoder().encode(s);
  }
  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  async function deriveKEKWithPBKDF2(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      utf8(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
      baseKey,
      { name: "AES-GCM", length: KEK_BYTES * 8 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function importKEKFromBytes(bytes) {
    return await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "AES-GCM", length: KEK_BYTES * 8 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function deriveKEKWithArgon2id(password, saltBytes, paramsHint) {
    if (typeof argon2 === "undefined" || !argon2 || typeof argon2.hash !== "function") {
      throw new Error("argon2 runtime not loaded");
    }
    const params = {
      time: Number((paramsHint && paramsHint.time) || ARGON2_TIME),
      mem: Number((paramsHint && paramsHint.mem) || ARGON2_MEM_KIB),
      parallelism: Number((paramsHint && paramsHint.parallelism) || ARGON2_PARALLELISM),
      hashLen: KEK_BYTES,
      type: argon2.ArgonType.Argon2id,
    };
    const pass = utf8(password);
    const res = await argon2.hash({
      pass,
      salt: saltBytes,
      time: params.time,
      mem: params.mem,
      parallelism: params.parallelism,
      hashLen: params.hashLen,
      type: params.type,
    });
    return {
      key: await importKEKFromBytes(res.hash),
      params: {
        time: params.time,
        mem: params.mem,
        parallelism: params.parallelism,
        hash_len: KEK_BYTES,
      },
    };
  }

  async function deriveKEK(password, saltBytes, kdfHint, kdfParams) {
    let parsedParams = kdfParams || null;
    if (!parsedParams && kdfHint && typeof kdfHint === "object") {
      parsedParams = kdfHint;
      kdfHint = parsedParams.kdf || parsedParams.name || "";
    }
    if (kdfHint === KDF_ARGON2ID || (!kdfHint && typeof argon2 !== "undefined")) {
      const derived = await deriveKEKWithArgon2id(password, saltBytes, parsedParams);
      return { kdf: KDF_ARGON2ID, key: derived.key, params: derived.params };
    }
    if (kdfHint && !isPbkdf2Sha256Kdf(kdfHint)) {
      throw new Error("unsupported KDF: " + kdfHint);
    }
    return {
      kdf: KDF_PBKDF2,
      key: await deriveKEKWithPBKDF2(password, saltBytes),
      params: { iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    };
  }

  async function aesWrap(kek, plaintextBytes) {
    const nonce = randomBytes(12);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, kek, plaintextBytes)
    );
    const out = new Uint8Array(nonce.length + ct.length);
    out.set(nonce, 0);
    out.set(ct, nonce.length);
    return out;
  }

  async function aesUnwrap(kek, wrapped) {
    if (wrapped.length < 12) throw new Error("wrapped blob too short");
    const nonce = wrapped.slice(0, 12);
    const ct = wrapped.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, kek, ct);
    return new Uint8Array(pt);
  }

  async function generateAccountKey(email) {
    if (typeof openpgp === "undefined") {
      throw new Error("openpgp.js not loaded");
    }
    const kp = await openpgp.generateKey({
      type: "ecc",
      curve: "curve25519",
      userIDs: [{ name: "elvish-account:" + email, email }],
      format: "armored",
    });
    return {
      armoredPub: kp.publicKey,
      armoredPriv: kp.privateKey,
      revocationCertificate: kp.revocationCertificate,
    };
  }

  async function generateIdentityKey(email) {
    const kp = await openpgp.generateKey({
      type: "ecc",
      curve: "curve25519",
      userIDs: [{ name: email, email }],
      format: "armored",
    });
    return kp;
  }

  async function pgpWrapToAccount(armoredPlain, armoredAccountPub) {
    const accountPub = await openpgp.readKey({ armoredKey: armoredAccountPub });
    const messageObj = await openpgp.createMessage({ text: armoredPlain });
    const wrapped = await openpgp.encrypt({
      message: messageObj,
      encryptionKeys: [accountPub],
      format: "armored",
    });
    return wrapped;
  }

  async function pgpFingerprint(armoredKey) {
    const key = await openpgp.readKey({ armoredKey });
    const fp = key.getFingerprint();
    return fp.toUpperCase();
  }

  // Public bootstrap entrypoint used by /register submission.
  async function bootstrap(email, password) {
    if (!email || !password) throw new Error("email and password required");
    const account = await generateAccountKey(email);
    const identity = await generateIdentityKey(email);
    const salt = randomBytes(16);
    const { kdf, key: kek, params } = await deriveKEK(password, salt);
    const wrappedAccountSecret = await aesWrap(kek, utf8(account.armoredPriv));
    const wrappedIdentitySecret = await pgpWrapToAccount(identity.privateKey, account.armoredPub);
    const accountFingerprint = await pgpFingerprint(account.armoredPub);
    const identityFingerprint = await pgpFingerprint(identity.publicKey);
    return {
      account: {
        fingerprint: accountFingerprint,
        armored_public: account.armoredPub,
        wrapped_secret_b64: bytesToB64(wrappedAccountSecret),
        kdf,
        kdf_salt_b64: bytesToB64(salt),
        kdf_params: params,
      },
      identity: {
        email,
        fingerprint: identityFingerprint,
        armored_public: identity.publicKey,
        wrapped_secret_armored: wrappedIdentitySecret,
      },
    };
  }

  async function rewrapAccountForNewPassword(me, oldPassword, newPassword) {
    if (!me || !me.bootstrapped) throw new Error("account key not bootstrapped");
    const saltBytes = b64ToBytes(me.kdf_salt_b64);
    let oldParams = {};
    try { oldParams = JSON.parse(me.kdf_params_json || "{}"); } catch (_) {}
    const oldDerived = await deriveKEK(oldPassword, saltBytes, me.kdf, oldParams);
    const wrapped = b64ToBytes(me.wrapped_secret_b64);
    const privArmoredUtf8 = await aesUnwrap(oldDerived.key, wrapped);
    const newSalt = randomBytes(16);
    const newDerived = await deriveKEK(newPassword, newSalt, KDF_ARGON2ID);
    const newWrapped = await aesWrap(newDerived.key, privArmoredUtf8);
    return {
      wrapped_secret_b64: bytesToB64(newWrapped),
      kdf: newDerived.kdf,
      kdf_salt_b64: bytesToB64(newSalt),
      kdf_params_json: JSON.stringify(newDerived.params || {}),
    };
  }

  // Helpers exposed for unlock.js + key rotation.
  globalThis.ElvishKeygen = {
    bootstrap,
    deriveKEK,
    aesWrap,
    aesUnwrap,
    pgpWrapToAccount,
    pgpFingerprint,
    bytesToB64,
    b64ToBytes,
    utf8,
    randomBytes,
    rewrapAccountForNewPassword,
    KDF_PBKDF2,
    KDF_PBKDF2_LEGACY,
    KDF_ARGON2ID,
  };
})();
