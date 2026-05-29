// ELVISH mail envelope constants shared by future native encryption flows.
//
// The current mail UI still speaks OpenPGP for interoperability, but these
// constants define the versioned native envelope boundary so newer message
// formats do not have to overload legacy PGP concepts.

(function () {
  const Version = Object.freeze({
    V1: "v1",
  });

  const Mode = Object.freeze({
    NATIVE_ENCRYPTED: "native-encrypted",
    ALREADY_ENCRYPTED: "already-encrypted",
  });

  const BodyCipher = Object.freeze({
    XCHACHA20_POLY1305: "xchacha20-poly1305",
    AES_256_GCM: "aes-256-gcm",
    OPENPGP_MESSAGE: "openpgp-message",
  });

  const WrapAlgorithm = Object.freeze({
    ML_KEM_768: "ml-kem-768",
    ML_KEM_1024: "ml-kem-1024",
    OPENPGP: "openpgp",
    NONE: "none",
  });

  const SignatureAlgorithm = Object.freeze({
    NONE: "none",
    ML_DSA_65: "ml-dsa-65",
    OPENPGP: "openpgp",
  });

  const Provenance = Object.freeze({
    NATIVE_ENCRYPTED: "native_encrypted",
    ALREADY_ENCRYPTED: "already_encrypted",
    COMPATIBILITY_BRIDGE: "compatibility_bridge",
  });

  function validateManifest(manifest) {
    if (!manifest || manifest.version !== Version.V1) throw new Error("unsupported envelope version");
    if (!Object.values(Mode).includes(manifest.mode)) throw new Error("unsupported envelope mode");
    if (!Object.values(Provenance).includes(manifest.provenance)) throw new Error("unsupported envelope provenance");
    if (!Object.values(BodyCipher).includes(manifest.body_cipher)) throw new Error("unsupported body cipher");
    if (!manifest.body_blob_ref) throw new Error("body_blob_ref required");
    if (manifest.mode === Mode.NATIVE_ENCRYPTED && (!Array.isArray(manifest.recipient_wraps) || manifest.recipient_wraps.length === 0)) {
      throw new Error("native-encrypted envelope requires recipient_wraps");
    }
    return true;
  }

  globalThis.ElvishEnvelope = {
    Version,
    Mode,
    BodyCipher,
    WrapAlgorithm,
    SignatureAlgorithm,
    Provenance,
    validateManifest,
  };
})();
