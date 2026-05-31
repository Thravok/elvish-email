// ELVISH — KeyVault: unlocked account key + identity private keys.
//
// Account key material is cached in sessionStorage by default so reloads within the
// same browser tab can restore the unlocked vault without another password prompt.
// "Trust this device" persists to localStorage for cross-tab/cold reload convenience.
// Manual lock and log out clear the cache; idle timeout clears memory only (then restore
// from cache when possible).
//
// Password verification for unwrap never POSTs the password. We bind the derived
// KEK to this account by requiring the decrypted private key fingerprint to
// match GET /api/v1/account-key/me armored_public (Skiff-style: verifier-based
// login can move to SRP-6a without changing this client-side check).
//
// Idle timeout clears memory; explicit lock clears memory + local key cache; logout clears that plus the trusted-device flag.

(function () {
  const DEFAULT_IDLE_MS = 15 * 60 * 1000;
  /** Match internal/session defaultTTL (14d) so trusted idle does not outlive the cookie session. */
  const TRUSTED_IDLE_MS = 14 * 24 * 60 * 60 * 1000;
  const PERSIST_KEY = "elvish-keyvault-account-v1";
  const TRUSTED_DEVICE_KEY = "elvish-trusted-device-v1";
  const state = {
    accountPrivateKey: null,    // openpgp.PrivateKey
    accountPublicKey: null,     // openpgp.PublicKey
    accountArmoredPriv: "",
    accountFingerprint: "",
    identities: new Map(),      // fingerprint → { email, privateKey, publicKey, armoredPub }
    defaultIdentityFingerprint: "",
    lastTouchMs: 0,
    idleMs: DEFAULT_IDLE_MS,
    timer: null,
  };

  function storage() {
    try {
      if (readTrustedDeviceFlag()) {
        return globalThis.localStorage || null;
      }
      return globalThis.sessionStorage || null;
    } catch (_) {
      return null;
    }
  }

  function clearAllPersistedCaches() {
    for (const s of [globalThis.sessionStorage, globalThis.localStorage]) {
      if (!s) continue;
      try {
        s.removeItem(PERSIST_KEY);
      } catch (_) {
        // ignore
      }
    }
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function persistAccountCache(sessionEmail, accountArmoredPub) {
    const s = storage();
    if (!s || !state.accountArmoredPriv || !accountArmoredPub) return;
    try {
      s.setItem(PERSIST_KEY, JSON.stringify({
        version: 1,
        sessionEmail: normalizeEmail(sessionEmail),
        accountArmoredPriv: state.accountArmoredPriv,
        accountArmoredPub,
        accountFingerprint: state.accountFingerprint,
        storedAtMs: Date.now(),
        trustedDevice: readTrustedDeviceFlag(),
      }));
    } catch (_) {
      // Best effort only: if storage is unavailable, the vault still works in-memory.
    }
  }

  function clearPersistedAccountCache() {
    clearAllPersistedCaches();
  }

  function readTrustedDeviceFlag() {
    const s = storage();
    if (!s) return false;
    try {
      return s.getItem(TRUSTED_DEVICE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function clearTrustedDeviceFlag() {
    const s = storage();
    if (!s) return;
    try {
      s.removeItem(TRUSTED_DEVICE_KEY);
    } catch (_) {
      // ignore
    }
  }

  /** Persist opt-in from login; also reapplies idle duration and refreshes the timer if unlocked. */
  function setTrustedDevice(enabled) {
    const s = storage();
    if (s) {
      try {
        if (enabled) s.setItem(TRUSTED_DEVICE_KEY, "1");
        else s.removeItem(TRUSTED_DEVICE_KEY);
      } catch (_) {
        // ignore
      }
    }
    applyTrustedIdlePreference();
  }

  function applyTrustedIdlePreference() {
    setIdleMs(readTrustedDeviceFlag() ? TRUSTED_IDLE_MS : DEFAULT_IDLE_MS);
    if (state.accountPrivateKey) touch();
  }

  function getKeyVaultIdleMs() {
    return state.idleMs;
  }

  function readPersistedAccountCache() {
    const stores = readTrustedDeviceFlag()
      ? [globalThis.localStorage, globalThis.sessionStorage]
      : [globalThis.sessionStorage, globalThis.localStorage];
    for (const s of stores) {
      if (!s) continue;
      try {
        const raw = s.getItem(PERSIST_KEY);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1) {
          continue;
        }
        if (!parsed.accountArmoredPriv || !parsed.accountArmoredPub) {
          continue;
        }
        return parsed;
      } catch (_) {
        continue;
      }
    }
    clearAllPersistedCaches();
    return null;
  }

  async function fetchIdentityRows() {
    const r = await fetch("/api/v1/identities", { credentials: "include" });
    if (!r.ok) throw new Error("identities fetch failed (" + r.status + ")");
    const j = await r.json();
    return Array.isArray(j.identities) ? j.identities : [];
  }

  function touch() {
    state.lastTouchMs = Date.now();
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => zero({ clearPersisted: false }), state.idleMs);
  }

  function zero(opts) {
    const clearPersisted = !opts || opts.clearPersisted !== false;
    const clearTrustedDevice = clearPersisted && (!opts || opts.clearTrustedDevice !== false);
    state.accountPrivateKey = null;
    state.accountPublicKey = null;
    state.accountArmoredPriv = "";
    state.accountFingerprint = "";
    state.identities.clear();
    state.defaultIdentityFingerprint = "";
    state.lastTouchMs = 0;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (clearPersisted) {
      clearPersistedAccountCache();
      if (clearTrustedDevice) clearTrustedDeviceFlag();
    }
    if (clearPersisted && globalThis.ElvishMailCache && typeof globalThis.ElvishMailCache.purge === "function") {
      try { void globalThis.ElvishMailCache.purge(); } catch (_) { /* best effort */ }
    }
  }

  function setIdleMs(ms) {
    state.idleMs = Math.max(60 * 1000, Number(ms) || DEFAULT_IDLE_MS);
  }

  function normalizeFingerprint(fp) {
    return String(fp || "").replace(/\s+/g, "").toUpperCase();
  }

  /** OpenPGP v4 key id: last 16 hex digits of the fingerprint (matches server ParseArmoredPublicKeyMeta). */
  function fingerprintKeyId16(fp) {
    const x = normalizeFingerprint(fp);
    if (!x) return "";
    return x.length <= 16 ? x : x.slice(-16);
  }

  /** True if two fingerprint strings denote the same key (full vs 16-hex key id). */
  function fingerprintsEquivalent(a, b) {
    const x = normalizeFingerprint(a);
    const y = normalizeFingerprint(b);
    if (!x || !y) return false;
    if (x === y) return true;
    return fingerprintKeyId16(x) === fingerprintKeyId16(y);
  }

  async function hydrateUnlockedAccount(armoredPriv, armoredPub, expectedFingerprint) {
    if (typeof openpgp === "undefined") throw new Error("openpgp.js not loaded");
    let priv;
    try {
      priv = await openpgp.readPrivateKey({ armoredKey: armoredPriv });
    } catch (_) {
      throw new Error("Incorrect password.");
    }
    const fpFromPublishedPub = normalizeFingerprint(await ElvishKeygen.pgpFingerprint(armoredPub));
    if (expectedFingerprint && !fingerprintsEquivalent(expectedFingerprint, fpFromPublishedPub)) {
      throw new Error("Account key metadata mismatch.");
    }
    const privFp = normalizeFingerprint(priv.getFingerprint());
    if (!fpFromPublishedPub || privFp !== fpFromPublishedPub) {
      throw new Error("Incorrect password.");
    }
    state.accountPrivateKey = priv;
    state.accountPublicKey = await openpgp.readKey({ armoredKey: armoredPub });
    state.accountArmoredPriv = armoredPriv;
    state.accountFingerprint = fpFromPublishedPub;
    state.identities.clear();
    state.defaultIdentityFingerprint = "";
    touch();
    return state.accountFingerprint;
  }

  async function unlockAccount(meRow, password, opts) {
    if (typeof openpgp === "undefined") throw new Error("openpgp.js not loaded");
    let kdfParams = {};
    try { kdfParams = JSON.parse(meRow.kdf_params_json || "{}"); } catch (_) {}
    const k = await ElvishKeygen.deriveKEK(password, ElvishKeygen.b64ToBytes(meRow.kdf_salt_b64), meRow.kdf, kdfParams);
    const wrapped = ElvishKeygen.b64ToBytes(meRow.wrapped_secret_b64);
    let armoredPriv;
    try {
      armoredPriv = new TextDecoder().decode(await ElvishKeygen.aesUnwrap(k.key, wrapped));
    } catch (_) {
      throw new Error("Incorrect password.");
    }
    const fp = await hydrateUnlockedAccount(armoredPriv, meRow.armored_public, meRow.fingerprint);
    persistAccountCache(opts && opts.sessionEmail, meRow.armored_public);
    return fp;
  }

  /**
   * Restore the unlocked account key from browser storage when it belongs to
   * the current logged-in user.
   */
  async function tryRestoreAccountFromSession(opts) {
    const cached = readPersistedAccountCache();
    if (!cached) return false;
    const expectedEmail = normalizeEmail(opts && opts.sessionEmail);
    if (expectedEmail && cached.sessionEmail !== expectedEmail) {
      clearPersistedAccountCache();
      return false;
    }
    try {
      await hydrateUnlockedAccount(
        cached.accountArmoredPriv,
        cached.accountArmoredPub,
        cached.accountFingerprint
      );
      return true;
    } catch (_) {
      clearPersistedAccountCache();
      zero({ clearPersisted: false });
      return false;
    }
  }

  async function ensureIdentityUnlocked(fingerprint, rowsOptional) {
    if (!state.accountPrivateKey) throw new Error("account locked");
    const fpNorm = String(fingerprint || "").toUpperCase();
    if (!fpNorm) throw new Error("missing identity fingerprint");
    const kid = fingerprintKeyId16(fpNorm);
    if (kid && state.identities.has(kid)) return;
    const rows = rowsOptional || await fetchIdentityRows();
    const row = rows.find((x) => fingerprintsEquivalent(x.fingerprint, fpNorm));
    if (!row) throw new Error("identity not found");
    if (!row.armored_public || (!row.wrapped_secret_b64 && !row.wrapped_secret_armored)) {
      throw new Error("identity has no wrapped secret");
    }
    await unlockIdentity(row);
  }

  async function unlockIdentity(idRow) {
    if (!state.accountPrivateKey) throw new Error("account locked");
    // The wrapped private key is the armored output of openpgp.encrypt({format:"armored"});
    // the server transports it as base64 of those armored bytes for symmetry with the
    // account key. Decode either field name for forward/backward compat.
    let armoredWrapped = idRow.wrapped_secret_armored || "";
    if (!armoredWrapped && idRow.wrapped_secret_b64) {
      armoredWrapped = new TextDecoder().decode(ElvishKeygen.b64ToBytes(idRow.wrapped_secret_b64));
    }
    if (!armoredWrapped) throw new Error("identity has no wrapped private key");
    const message = await openpgp.readMessage({ armoredMessage: armoredWrapped });
    const { data: armoredPriv } = await openpgp.decrypt({
      message,
      decryptionKeys: [state.accountPrivateKey],
    });
    const privateKey = await openpgp.readPrivateKey({ armoredKey: armoredPriv });
    const publicKey = await openpgp.readKey({ armoredKey: idRow.armored_public });
    const idPubFp = normalizeFingerprint(await ElvishKeygen.pgpFingerprint(idRow.armored_public));
    if (idRow.fingerprint && !fingerprintsEquivalent(idRow.fingerprint, idPubFp)) {
      throw new Error("identity metadata mismatch");
    }
    const idPrivFp = normalizeFingerprint(privateKey.getFingerprint());
    if (!idPubFp || idPrivFp !== idPubFp) {
      throw new Error("identity key does not match encrypted blob");
    }
    const fpKey = fingerprintKeyId16(idPubFp);
    state.identities.set(fpKey, {
      email: idRow.email,
      privateKey,
      publicKey,
      armoredPub: idRow.armored_public,
      armoredPriv,
    });
    if (idRow.is_default || !state.defaultIdentityFingerprint) {
      state.defaultIdentityFingerprint = fpKey;
    }
    touch();
    return fpKey;
  }

  /**
   * Export one identity (per-address) private key as ASCII armor for backup or external
   * OpenPGP tools. The account master private key is intentionally not exportable.
   *
   * @param {string} fingerprint identity fingerprint (any casing; long or 16-char form)
   * @param {{ passphrase?: string }} [opts] If `passphrase` is a non-empty string, the key is
   *   exported in RFC 4880 passphrase-encrypted form via OpenPGP.js (GnuPG-compatible S2K).
   */
  async function exportIdentityPrivateKeyArmored(fingerprint, opts) {
    if (typeof openpgp === "undefined") throw new Error("OpenPGP not loaded");
    const fpNorm = String(fingerprint || "").toUpperCase();
    await ensureIdentityUnlocked(fpNorm);
    const ident = getIdentity(fpNorm);
    if (!ident || !ident.privateKey) throw new Error("identity private key not available");
    const rawPass = opts && opts.passphrase != null ? String(opts.passphrase) : "";
    const passphrase = rawPass.trim();
    if (passphrase) {
      if (passphrase.length < 8) {
        throw new Error("Export passphrase must be at least 8 characters.");
      }
      const encrypted = await openpgp.encryptKey({ privateKey: ident.privateKey, passphrase });
      touch();
      return encrypted.armor();
    }
    touch();
    if (ident.armoredPriv) return ident.armoredPriv;
    return ident.privateKey.armor();
  }

  function getIdentity(fingerprint) {
    touch();
    let fp = fingerprint || state.defaultIdentityFingerprint;
    if (!fp) return null;
    const kid = fingerprintKeyId16(String(fp).toUpperCase());
    return (kid && state.identities.get(kid)) || null;
  }

  function getIdentityByEmail(email) {
    touch();
    const target = normalizeEmail(email);
    if (!target) return null;
    for (const [fingerprint, ident] of state.identities.entries()) {
      if (normalizeEmail(ident && ident.email) !== target) continue;
      return { fingerprint, ...ident };
    }
    return null;
  }

  function listIdentities() {
    touch();
    const out = [];
    for (const [fp, v] of state.identities.entries()) {
      out.push({ fingerprint: fp, email: v.email, armored_public: v.armoredPub });
    }
    return out;
  }

  async function deriveIdentitySearchSeed(fingerprint) {
    const ident = getIdentity(fingerprint);
    if (!ident || !ident.armoredPriv) throw new Error("identity not unlocked");
    const label = new TextEncoder().encode("elvish-search-seed-v1:");
    const body = new TextEncoder().encode(ident.armoredPriv);
    const merged = new Uint8Array(label.length + body.length);
    merged.set(label, 0);
    merged.set(body, label.length);
    const digest = await crypto.subtle.digest("SHA-256", merged);
    touch();
    return new Uint8Array(digest);
  }

  async function deriveAccountSenderIconSeed() {
    if (!state.accountPrivateKey || !state.accountArmoredPriv) throw new Error("account not unlocked");
    const label = new TextEncoder().encode("elvish-sender-icon-seed-v1:");
    const body = new TextEncoder().encode(state.accountArmoredPriv);
    const merged = new Uint8Array(label.length + body.length);
    merged.set(label, 0);
    merged.set(body, label.length);
    const digest = await crypto.subtle.digest("SHA-256", merged);
    touch();
    return new Uint8Array(digest);
  }

  async function deriveAccountMailCacheSeed() {
    if (!state.accountPrivateKey || !state.accountArmoredPriv) throw new Error("account not unlocked");
    const label = new TextEncoder().encode("elvish-mail-cache-seed-v1:");
    const body = new TextEncoder().encode(state.accountArmoredPriv);
    const merged = new Uint8Array(label.length + body.length);
    merged.set(label, 0);
    merged.set(body, label.length);
    const digest = await crypto.subtle.digest("SHA-256", merged);
    touch();
    return new Uint8Array(digest);
  }

  async function ensureIdentityUnlockedByEmail(email, rowsOptional) {
    if (!state.accountPrivateKey) throw new Error("account locked");
    const target = normalizeEmail(email);
    if (!target) throw new Error("missing identity email");
    const existing = getIdentityByEmail(target);
    if (existing && existing.fingerprint) return existing.fingerprint;
    const rows = rowsOptional || await fetchIdentityRows();
    const row = rows.find((x) => normalizeEmail(x && x.email) === target);
    if (!row) throw new Error("identity not found");
    if (!row.armored_public || (!row.wrapped_secret_b64 && !row.wrapped_secret_armored)) {
      throw new Error("identity has no wrapped secret");
    }
    return await unlockIdentity(row);
  }

  async function encryptToRecipient(armoredRecipientPub, plaintext) {
    touch();
    const recipient = await openpgp.readKey({ armoredKey: armoredRecipientPub });
    const opts = (plaintext instanceof Uint8Array)
      ? { binary: plaintext }
      : { text: String(plaintext == null ? "" : plaintext) };
    const message = await openpgp.createMessage(opts);
    return await openpgp.encrypt({ message, encryptionKeys: [recipient], format: "armored" });
  }

  async function encryptAndSignToRecipient(armoredRecipientPub, plaintext, signerFingerprint) {
    touch();
    const fpNorm = String(signerFingerprint || "").toUpperCase();
    await ensureIdentityUnlocked(fpNorm);
    const ident = getIdentity(fpNorm);
    if (!ident) throw new Error("no unlocked signing identity");
    const recipient = await openpgp.readKey({ armoredKey: armoredRecipientPub });
    const opts = (plaintext instanceof Uint8Array)
      ? { binary: plaintext }
      : { text: String(plaintext == null ? "" : plaintext) };
    const message = await openpgp.createMessage(opts);
    return await openpgp.encrypt({
      message,
      encryptionKeys: [recipient],
      signingKeys: [ident.privateKey],
      format: "armored",
    });
  }

  async function readVerificationKeys(armoredPublicKeys) {
    const source = Array.isArray(armoredPublicKeys)
      ? armoredPublicKeys.filter(Boolean).join("\n")
      : String(armoredPublicKeys || "");
    const trimmed = source.trim();
    if (!trimmed) return [];
    if (typeof openpgp.readKeys === "function") {
      return await openpgp.readKeys({ armoredKeys: trimmed });
    }
    return [await openpgp.readKey({ armoredKey: trimmed })];
  }

  function signatureKeyIDHex(signature) {
    try {
      if (signature && signature.keyID && typeof signature.keyID.toHex === "function") {
        return String(signature.keyID.toHex() || "").toUpperCase();
      }
    } catch (_) {
      // ignore
    }
    return "";
  }

  function fingerprintFromVerificationKeys(verificationKeys, signerKeyIDs) {
    const ids = Array.isArray(signerKeyIDs) ? signerKeyIDs.filter(Boolean) : [];
    for (const key of (verificationKeys || [])) {
      try {
        const fp = normalizeFingerprint(key && typeof key.getFingerprint === "function" ? key.getFingerprint() : "");
        if (!fp) continue;
        const shortID = fingerprintKeyId16(fp);
        if (ids.length === 0 || ids.includes(shortID)) return fp;
      } catch (_) {
        // ignore
      }
    }
    return "";
  }

  async function summarizeSignatureVerification(signatures, verificationKeys) {
    const signerKeyIDs = Array.isArray(signatures)
      ? signatures.map((signature) => signatureKeyIDHex(signature)).filter(Boolean)
      : [];
    if (!Array.isArray(signatures) || signatures.length === 0) {
      return {
        status: "unsigned",
        signed: false,
        signerKeyIDs: [],
        signerFingerprint: "",
        error: "",
      };
    }
    if (!Array.isArray(verificationKeys) || verificationKeys.length === 0) {
      return {
        status: "missing_public_key",
        signed: true,
        signerKeyIDs,
        signerFingerprint: "",
        error: "signing key unavailable",
      };
    }
    let firstErr = null;
    for (const signature of signatures) {
      try {
        if (signature && signature.verified) await signature.verified;
        return {
          status: "verified",
          signed: true,
          signerKeyIDs,
          signerFingerprint: fingerprintFromVerificationKeys(verificationKeys, signerKeyIDs),
          error: "",
        };
      } catch (err) {
        if (!firstErr) firstErr = err;
      }
    }
    return {
      status: "bad_signature",
      signed: true,
      signerKeyIDs,
      signerFingerprint: fingerprintFromVerificationKeys(verificationKeys, signerKeyIDs),
      error: firstErr ? ((firstErr && firstErr.message) || String(firstErr)) : "signature verification failed",
    };
  }

  function looksLikeArmoredMessage(text) {
    return /^[\s\r\n\t]*-----BEGIN PGP (MESSAGE|SIGNED MESSAGE)-----/.test(text || "");
  }

  function extractArmoredBlock(text) {
    const match = String(text || "").match(/-----BEGIN PGP (?:MESSAGE|SIGNED MESSAGE)-----[\s\S]*?-----END PGP (?:MESSAGE|SIGNATURE)-----/);
    return match ? match[0].trim() : "";
  }

  function extractContentTypeValue(headerText) {
    const lines = String(headerText || "").replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
      const m = /^content-type:\s*(.+)$/i.exec(line.trim());
      if (m) return m[1].trim();
    }
    return "";
  }

  function extractMimeBoundary(contentTypeHeaderValue) {
    const m = String(contentTypeHeaderValue || "").match(/boundary="?([^";\s]+)"?/i);
    return m ? m[1].trim() : "";
  }

  function splitMimePartsLoose(body, boundary) {
    const b = String(boundary || "").trim();
    if (!b) return [];
    const src = String(body || "");
    const splitToken = `--${b}`;
    const rawParts = src.split(splitToken);
    const out = [];
    for (let i = 1; i < rawParts.length; i += 1) {
      let p = rawParts[i];
      if (p.startsWith("\r\n")) p = p.slice(2);
      else if (p.startsWith("\n")) p = p.slice(1);
      p = p.replace(/--[\r\n]*$/, "").trimEnd();
      if (p) out.push(p);
    }
    return out;
  }

  function extractArmoredCleartextSignedBlock(text) {
    const m = String(text || "").match(/-----BEGIN PGP SIGNED MESSAGE-----[\s\S]*?-----END PGP SIGNATURE-----/);
    return m ? m[0].trim() : "";
  }

  function extractArmoredDetachedSignatureBlob(text) {
    const m = String(text || "").match(/-----BEGIN PGP SIGNATURE-----[\s\S]*?-----END PGP SIGNATURE-----/);
    return m ? m[0].trim() : "";
  }

  /**
   * After decrypting an RFC822 message, detect nested cleartext-signed or PGP/MIME
   * multipart/signed payloads and verify them with the same shape as decrypt-time
   * signature summaries. Returns null when no nested signed material applies.
   */
  async function verifyNestedSignedPayloadAfterDecrypt(decryptedRfc822, opts) {
    if (typeof openpgp === "undefined") return null;
    const keys = await readVerificationKeys(opts && opts.armoredPublicKeys);
    if (!keys.length) return null;
    const text = String(decryptedRfc822 || "");
    let headerText = "";
    let body = "";
    const dbl = text.indexOf("\r\n\r\n");
    if (dbl >= 0) {
      headerText = text.slice(0, dbl);
      body = text.slice(dbl + 4);
    } else {
      const dbln = text.indexOf("\n\n");
      if (dbln < 0) return null;
      headerText = text.slice(0, dbln);
      body = text.slice(dbln + 2);
    }
    const ctValue = extractContentTypeValue(headerText);
    const mimeRoot = ctValue.split(";")[0].trim().toLowerCase();

    if (mimeRoot === "multipart/signed" && /application\/(pgp|x-pgp)-signature/i.test(ctValue)) {
      const boundary = extractMimeBoundary(ctValue);
      if (!boundary) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: "multipart/signed missing boundary",
        };
      }
      const parts = splitMimePartsLoose(body, boundary);
      if (parts.length < 2) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: "multipart/signed missing parts",
        };
      }
      const signedPart = parts[0];
      const sigPartRaw = parts[1];
      const sigHdrEnd = sigPartRaw.indexOf("\r\n\r\n") >= 0 ? sigPartRaw.indexOf("\r\n\r\n") : sigPartRaw.indexOf("\n\n");
      if (sigHdrEnd < 0) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: "signature part malformed",
        };
      }
      const sigBody = sigPartRaw.slice(sigHdrEnd + (sigPartRaw.indexOf("\r\n\r\n") >= 0 ? 4 : 2));
      const sigArmored = extractArmoredDetachedSignatureBlob(sigBody);
      if (!sigArmored) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: "missing detached signature",
        };
      }
      try {
        const signature = await openpgp.readSignature({ armoredSignature: sigArmored });
        const signedBytes = new TextEncoder().encode(signedPart);
        const literalMessage = await openpgp.createMessage({ binary: signedBytes });
        const verified = await openpgp.verify({
          message: literalMessage,
          signature,
          verificationKeys: keys,
        });
        const sigs = verified && verified.signatures ? verified.signatures : [];
        return summarizeSignatureVerification(sigs, keys);
      } catch (err) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: (err && err.message) || String(err),
        };
      }
    }

    const cleartextArmored = extractArmoredCleartextSignedBlock(body.trimStart());
    if (cleartextArmored && typeof openpgp.readCleartextMessage === "function") {
      try {
        const cleartext = await openpgp.readCleartextMessage({ cleartextMessage: cleartextArmored });
        const sigListRaw = await cleartext.verify({ verificationKeys: keys });
        const sigList = Array.isArray(sigListRaw)
          ? sigListRaw
          : (sigListRaw && sigListRaw.signatures ? sigListRaw.signatures : []);
        return summarizeSignatureVerification(sigList, keys);
      } catch (err) {
        return {
          status: "bad_signature",
          signed: true,
          signerKeyIDs: [],
          signerFingerprint: "",
          error: (err && err.message) || String(err),
        };
      }
    }

    return null;
  }

  function parseMimeHeaders(headerBlock) {
    const headers = {};
    let current = "";
    for (const line of String(headerBlock || "").split("\n")) {
      if (!line) return null;
      if (/^[ \t]/.test(line)) {
        if (!current) return null;
        headers[current] += " " + line.trim();
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
    const cleaned = String(raw || "").replace(/\s+/g, "");
    const bin = atob(cleaned);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  function quotedPrintableToBytes(raw) {
    const text = String(raw || "").replace(/=\r?\n/g, "");
    const bytes = [];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
        bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
        i += 2;
        continue;
      }
      bytes.push(text.charCodeAt(i) & 0xff);
    }
    return new Uint8Array(bytes);
  }

  function decodeTransferBytes(body, transferEncoding) {
    const encoding = String(transferEncoding || "").trim().toLowerCase();
    if (encoding === "base64") return base64ToBytes(body);
    if (encoding === "quoted-printable") return quotedPrintableToBytes(body);
    return new TextEncoder().encode(String(body || ""));
  }

  function extractPGPMimePayload(bytes) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes || new Uint8Array());
    const normalized = text.replace(/\r\n/g, "\n");
    const separatorIndex = normalized.indexOf("\n\n");
    if (separatorIndex <= 0) return null;
    const headers = parseMimeHeaders(normalized.slice(0, separatorIndex));
    if (!headers) return null;
    const contentType = String(headers["content-type"] || "");
    const boundaryMatch = contentType.match(/boundary="?([^";\n]+)"?/i);
    if (!/multipart\/encrypted/i.test(contentType) || !boundaryMatch) return null;
    const boundary = `--${boundaryMatch[1]}`;
    const body = normalized.slice(separatorIndex + 2);
    for (const rawPart of body.split(boundary)) {
      let part = rawPart.trim();
      if (!part || part === "--") continue;
      if (part.endsWith("--")) part = part.slice(0, -2).trim();
      const partSeparator = part.indexOf("\n\n");
      if (partSeparator <= 0) continue;
      const partHeaders = parseMimeHeaders(part.slice(0, partSeparator));
      if (!partHeaders) continue;
      const partBody = part.slice(partSeparator + 2).replace(/^\n+|\n+$/g, "");
      const partType = String(partHeaders["content-type"] || "");
      if (/application\/pgp-encrypted/i.test(partType) && /version:\s*1/i.test(partBody)) {
        continue;
      }
      if (
        /application\/octet-stream/i.test(partType) ||
        /application\/pgp-encrypted/i.test(partType) ||
        looksLikeArmoredMessage(partBody)
      ) {
        const decoded = decodeTransferBytes(partBody, partHeaders["content-transfer-encoding"]);
        const armored = extractArmoredBlock(new TextDecoder("utf-8", { fatal: false }).decode(decoded));
        return armored ? new TextEncoder().encode(armored) : decoded;
      }
    }
    return null;
  }

  async function readEncryptedMessage(ciphertext) {
    if (typeof ciphertext === "string") {
      const armored = extractArmoredBlock(ciphertext);
      if (armored) {
        return openpgp.readMessage({ armoredMessage: armored });
      }
      ciphertext = new TextEncoder().encode(ciphertext);
    }
    const bytes = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext || []);
    const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 160)));
    if (looksLikeArmoredMessage(prefix)) {
      return openpgp.readMessage({ armoredMessage: new TextDecoder().decode(bytes) });
    }
    const fullText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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

  async function decryptToString(ciphertext, fingerprint, rowsOptional) {
    const res = await decryptToResult(ciphertext, fingerprint, { rows: rowsOptional });
    return res.data;
  }

  async function decryptToResult(ciphertext, fingerprint, opts) {
    const fpNorm = String(fingerprint || "").toUpperCase();
    const rowsOptional = opts && opts.rows;
    await ensureIdentityUnlocked(fpNorm, rowsOptional);
    const ident = getIdentity(fpNorm);
    if (!ident) throw new Error("no unlocked identity");
    const message = await readEncryptedMessage(ciphertext);
    const verificationKeys = await readVerificationKeys(opts && opts.armoredPublicKeys);
    const decryptOptions = {
      message,
      decryptionKeys: [ident.privateKey],
      format: "utf8",
    };
    if (verificationKeys.length > 0) decryptOptions.verificationKeys = verificationKeys;
    const { data, signatures } = await openpgp.decrypt(decryptOptions);
    touch();
    return {
      data,
      verification: await summarizeSignatureVerification(signatures, verificationKeys),
    };
  }

  // decryptForIdentity is the alias used by mail-manifest.js for manifest
  // header decryption; ciphertext arrives as bytes but may be armored or binary.
  async function decryptForIdentity(fingerprint, ciphertextBytes) {
    return decryptToString(ciphertextBytes, fingerprint);
  }

  async function decryptForIdentityResult(fingerprint, ciphertextBytes, opts) {
    return decryptToResult(ciphertextBytes, fingerprint, opts);
  }

  // tryDefaultDecrypt iterates every unlocked identity until one decrypts the
  // ciphertext. Used when the caller doesn't yet know which identity to use
  // (e.g. inbound messages addressed to one of several aliases).
  async function tryDefaultDecrypt(ciphertext) {
    if (!isUnlocked()) throw new Error("locked");
    const rows = await fetchIdentityRows();
    const usable = rows.filter((r) => r && r.armored_public && (r.wrapped_secret_b64 || r.wrapped_secret_armored));
    let fps = usable.map((r) => String(r.fingerprint || "").toUpperCase()).filter(Boolean);
    const defRow = usable.find((r) => r.is_default);
    const defFp = defRow ? String(defRow.fingerprint || "").toUpperCase() : "";
    if (defFp) {
      const i = fps.indexOf(defFp);
      if (i > 0) {
        fps.splice(i, 1);
        fps.unshift(defFp);
      }
    }
    if (fps.length === 0) {
      fps = Array.from(state.identities.keys());
      if (state.defaultIdentityFingerprint) {
        const i = fps.indexOf(state.defaultIdentityFingerprint);
        if (i > 0) {
          fps.splice(i, 1);
          fps.unshift(state.defaultIdentityFingerprint);
        }
      }
    }
    let lastErr = null;
    for (const fp of fps) {
      try {
        return { data: await decryptToString(ciphertext, fp, rows), fingerprint: fp };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("no identity decrypts message");
  }

  function isUnlocked() {
    return !!state.accountPrivateKey;
  }

  function fingerprint() {
    return state.accountFingerprint;
  }

  applyTrustedIdlePreference();

  globalThis.ElvishKeyVault = {
    unlockAccount,
    unlockIdentity,
    ensureIdentityUnlocked,
    exportIdentityPrivateKeyArmored,
    ensureIdentityUnlockedByEmail,
    encryptToRecipient,
    encryptAndSignToRecipient,
    decryptToString,
    decryptToResult,
    decryptForIdentity,
    decryptForIdentityResult,
    verifyNestedSignedPayloadAfterDecrypt,
    tryDefaultDecrypt,
    tryRestoreAccountFromSession,
    getIdentity,
    getIdentityByEmail,
    listIdentities,
    deriveIdentitySearchSeed,
    deriveAccountSenderIconSeed,
    deriveAccountMailCacheSeed,
    fingerprint,
    isUnlocked,
    zero,
    touch,
    setIdleMs,
    setTrustedDevice,
    isTrustedDevice: readTrustedDeviceFlag,
    getKeyVaultIdleMs,
  };
})();
