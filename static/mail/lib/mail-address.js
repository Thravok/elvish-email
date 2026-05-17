/** Sender / fingerprint helpers shared across mail UI. */

export function canonicalizeSenderId(fromValue) {
  const raw = String(fromValue || "").trim();
  if (!raw) return "";
  const bracketMatch = raw.match(/<\s*([^<>\s@]+@[^<>\s@]+)\s*>/);
  if (bracketMatch && bracketMatch[1]) return bracketMatch[1].trim().toLowerCase();
  const emailMatch = raw.match(/([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (emailMatch && emailMatch[1]) return emailMatch[1].trim().toLowerCase();
  return raw.replace(/\s+/g, " ").toLowerCase();
}

export function extractArmoredPublicKey(record) {
  if (!record || typeof record !== "object") return "";
  if (typeof record.armored_public === "string" && record.armored_public.trim()) return record.armored_public.trim();
  if (typeof record.armoredPub === "string" && record.armoredPub.trim()) return record.armoredPub.trim();
  if (typeof record.armored === "string" && record.armored.trim()) return record.armored.trim();
  return "";
}

export function normalizeFingerprintHex(s) {
  const raw = String(s || "").toUpperCase();
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if ((c >= "0" && c <= "9") || (c >= "A" && c <= "F")) out += c;
  }
  return out;
}

export function fingerprintsMatch(a, b) {
  const x = normalizeFingerprintHex(a);
  const y = normalizeFingerprintHex(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 16 && y.length >= 16 && (x.endsWith(y.slice(-16)) || y.endsWith(x.slice(-16)))) return true;
  return false;
}
