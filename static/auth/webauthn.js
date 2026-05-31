(function () {
  function b64urlToBytes(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64url(bytes) {
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer || bytes);
    let bin = "";
    for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function normalizeCreationOptions(options) {
    const out = structuredClone(options);
    if (out && out.publicKey) {
      out.publicKey.challenge = b64urlToBytes(out.publicKey.challenge);
      if (out.publicKey.user && out.publicKey.user.id) out.publicKey.user.id = b64urlToBytes(out.publicKey.user.id);
      if (Array.isArray(out.publicKey.excludeCredentials)) {
        out.publicKey.excludeCredentials = out.publicKey.excludeCredentials.map((cred) => ({
          ...cred,
          id: b64urlToBytes(cred.id),
        }));
      }
    }
    return out;
  }

  function normalizeRequestOptions(options) {
    const out = structuredClone(options);
    if (out && out.publicKey) {
      out.publicKey.challenge = b64urlToBytes(out.publicKey.challenge);
      if (Array.isArray(out.publicKey.allowCredentials)) {
        out.publicKey.allowCredentials = out.publicKey.allowCredentials.map((cred) => ({
          ...cred,
          id: b64urlToBytes(cred.id),
        }));
      }
    }
    return out;
  }

  function serializeCredential(credential) {
    if (!credential) throw new Error("Missing WebAuthn credential");
    const response = credential.response || {};
    const out = {
      id: credential.id,
      rawId: bytesToB64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      response: {},
      clientExtensionResults: typeof credential.getClientExtensionResults === "function"
        ? credential.getClientExtensionResults()
        : {},
    };
    if (response.clientDataJSON) out.response.clientDataJSON = bytesToB64url(response.clientDataJSON);
    if (response.attestationObject) out.response.attestationObject = bytesToB64url(response.attestationObject);
    if (response.authenticatorData) out.response.authenticatorData = bytesToB64url(response.authenticatorData);
    if (response.signature) out.response.signature = bytesToB64url(response.signature);
    if (response.userHandle) out.response.userHandle = bytesToB64url(response.userHandle);
    if (response.transports && typeof response.transports === "function") out.response.transports = response.transports();
    return out;
  }

  function requireSecureContext() {
    if (window.isSecureContext) return;
    const origin = window.location && window.location.origin ? window.location.origin : "this page";
    throw new Error("Security keys require HTTPS or localhost. Current origin is not a secure context: " + origin);
  }

  async function createCredential(options) {
    if (!window.PublicKeyCredential || !navigator.credentials || !navigator.credentials.create) {
      throw new Error("This browser does not support security-key registration");
    }
    requireSecureContext();
    const credential = await navigator.credentials.create(normalizeCreationOptions(options));
    return serializeCredential(credential);
  }

  async function getAssertion(options) {
    if (!window.PublicKeyCredential || !navigator.credentials || !navigator.credentials.get) {
      throw new Error("This browser does not support security-key verification");
    }
    requireSecureContext();
    const credential = await navigator.credentials.get(normalizeRequestOptions(options));
    return serializeCredential(credential);
  }

  window.ElvishWebAuthn = {
    createCredential,
    getAssertion,
  };
})();
