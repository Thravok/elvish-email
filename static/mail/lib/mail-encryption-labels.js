/** Maps server `provenance` to user-facing encryption labels. */

export function messageEncryptionDisplay(provenance) {
  const p = String(provenance || "").trim();
  if (p === "client_encrypted") {
    return {
      id: "e2ee",
      label: "E2EE encrypted",
      title:
        "Encrypted end-to-end by the Elvish client before upload. Strongest when both sides use Elvish; the server only stores ciphertext.",
      flagClass: "mail-enc-e2ee",
    };
  }
  if (p === "already_encrypted" || p === "sender_pgp_mime") {
    return {
      id: "pgp",
      label: "PGP encrypted",
      title:
        p === "already_encrypted"
          ? "Arrived over SMTP already wrapped in OpenPGP for your key."
          : "Body is stored as OpenPGP-encrypted mail (e.g. external PGP or a PGP-wrapped SMTP submission).",
      flagClass: "mail-enc-pgp",
    };
  }
  if (p === "smtp_gateway_encrypted") {
    return {
      id: "stored",
      label: "Stored encrypted",
      title:
        "Plaintext reached the gateway and was wrapped to your identity key before storage (legacy inbound SMTP path).",
      flagClass: "mail-enc-stored",
    };
  }
  return {
    id: "unknown",
    label: "Encrypted",
    title: p ? `Encrypted payload (server provenance: ${p}).` : "Encrypted payload; provenance not reported.",
    flagClass: "mail-enc-unknown",
  };
}
