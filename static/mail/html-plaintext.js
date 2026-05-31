/** Shared HTML→plain-text helpers (DOMParser-first; avoids regex tag-strip false positives). */

export function stripHtmlBlocks(html) {
  const raw = String(html || "");
  if (typeof DOMParser === "undefined") {
    return raw.replace(/<[^>]+>/g, " ");
  }
  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("script, style").forEach((node) => node.remove());
  return doc.body.innerHTML || "";
}

export function decodeHtmlEntities(text) {
  const raw = String(text || "");
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return doc.documentElement.textContent || "";
  }
  return raw;
}

export function innerPlain(fragment) {
  return decodeHtmlEntities(String(fragment || "").replace(/<[^>]+>/g, " ")).trim();
}

export function htmlToDisplayText(html) {
  let text = stripHtmlBlocks(html);
  text = text
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToPlainSearchText(html) {
  return decodeHtmlEntities(stripHtmlBlocks(html).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function randomAlphanumeric(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function validatedSameOriginScriptURL(raw, baseHref) {
  const u = new URL(String(raw || ""), baseHref || self.location.href);
  if (u.origin !== new URL(baseHref || self.location.href).origin) {
    throw new Error("script URL must be same-origin");
  }
  if (!u.pathname.startsWith("/static/")) {
    throw new Error("script URL path not allowed");
  }
  return u.href;
}
