// ELVISH MAIL — brutalist encrypted mail client.
// Real wiring: ElvishMailManifest for /api/v1/mail/*; ElvishKeyVault for header
// + body decryption; ElvishMailUnlockModal for blocking re-derive-in-place.
import { htmlToDisplayText } from "./html-plaintext.js";
import React from "react";
import { Icons, FOLDERS } from "./mail-icons.jsx";
import { formatDate, formatFullDate, formatAttachmentSize } from "./lib/mail-format-helpers.js";
import { messageEncryptionDisplay } from "./lib/mail-encryption-labels.js";
import { canonicalizeSenderId, extractArmoredPublicKey, normalizeFingerprintHex, fingerprintsMatch } from "./lib/mail-address.js";
import { MessageList, MessageContextMenu } from "./mail-message-list.jsx";

const { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } = React;

const BACKGROUND_RECOVERY_CONCURRENCY = 2;

const EMPTY_SENDER_PROFILES = Object.freeze({});

/** Document shell + defaults for the mail HTML preview iframe (same-origin srcDoc). */
const MAIL_HTML_IFRAME_DOC_PREFIX =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: https:; base-uri \'none\'">' +
  "<style>" +
  "html,body{margin:0;min-height:100%;overflow-wrap:anywhere}" +
  "body{box-sizing:border-box;font-family:system-ui,Segoe UI,sans-serif;padding:16px 22px;line-height:1.55;word-break:break-word;background:#0f1218;color:#e6eaf2}" +
  "img,video{max-width:100%;height:auto}" +
  "table{max-width:100%;border-collapse:collapse}" +
  "pre{overflow:auto;max-width:100%}" +
  "</style></head><body>";

const MAIL_HTML_IFRAME_DOC_SUFFIX = "</body></html>";

function measureMailHtmlIframeContentHeight(iframe) {
  try {
    const doc = iframe && iframe.contentDocument;
    if (!doc || !doc.documentElement) return null;
    const root = doc.documentElement;
    const body = doc.body;
    const h = Math.max(
      root.scrollHeight,
      body ? body.scrollHeight : 0,
      root.getBoundingClientRect().height,
    );
    return Number.isFinite(h) && h > 0 ? h : null;
  } catch (_) {
    return null;
  }
}

/** After a failed script load, distinguish operator-only 403 from other failures (see admin_ui_gate). */
async function probeMailAdminEmbedFailReason() {
  try {
    const r = await fetch("/dist/mail-admin-embed.js", {
      method: "HEAD",
      credentials: "same-origin",
      cache: "no-store",
    });
    return r.status === 403 ? "forbidden" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Pull armored PUBLIC KEY blocks from decrypted MIME attachments. */
function extractPublicKeysFromMimeAttachments(attachments) {
  const out = [];
  if (!Array.isArray(attachments)) return out;
  const seen = new Set();
  for (const a of attachments) {
    if (!a || !a.bytes) continue;
    const ct = String(a.content_type || "").toLowerCase();
    const fn = String(a.file_name || "").toLowerCase();
    const looksKey =
      ct.includes("application/pgp-keys") ||
      ct.includes("pgp-key") ||
      /\.asc$/i.test(fn) ||
      /^public-.*\.asc$/i.test(fn);
    if (!looksKey && ct && !ct.startsWith("text/")) continue;
    try {
      const text =
        typeof a.bytes === "string"
          ? a.bytes
          : new TextDecoder("utf-8", { fatal: false }).decode(a.bytes instanceof Uint8Array ? a.bytes : new Uint8Array(a.bytes));
      const blocks = text.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/g);
      if (!blocks) continue;
      for (const b of blocks) {
        const t = b.trim();
        if (t && !seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
    } catch (_) {
      // ignore
    }
  }
  return out;
}

async function buildCombinedVerificationArmored(fromValue, identities, attachmentArmoredList) {
  const senderEmail = canonicalizeSenderId(fromValue);
  const attachmentArmoreds = Array.isArray(attachmentArmoredList) ? attachmentArmoredList.filter(Boolean) : [];
  if (!senderEmail) {
    return {
      senderEmail: "",
      combinedArmored: "",
      localIdentity: null,
      trustedContactRecord: null,
      directoryHit: null,
      attachmentArmoreds,
    };
  }

  const parts = [];
  const localIdentity = (identities || []).find(
    (identity) => canonicalizeSenderId(identity && identity.email) === senderEmail && extractArmoredPublicKey(identity)
  );
  if (localIdentity) {
    const arm = extractArmoredPublicKey(localIdentity);
    if (arm) parts.push(arm);
  }

  let trustedContactRecord = null;
  if (!localIdentity && window.ElvishMailManifest && typeof window.ElvishMailManifest.getContactKey === "function") {
    try {
      const record = await window.ElvishMailManifest.getContactKey(senderEmail);
      if (record && record.trusted === true && extractArmoredPublicKey(record)) {
        trustedContactRecord = record;
        parts.push(extractArmoredPublicKey(record));
      }
    } catch (_) {
      // best effort
    }
  }

  for (const arm of attachmentArmoreds) {
    if (arm && !parts.includes(arm)) parts.push(arm);
  }

  let directoryHit = null;
  if (window.ElvishMailManifest && typeof window.ElvishMailManifest.lookupKey === "function") {
    try {
      const record = await window.ElvishMailManifest.lookupKey(senderEmail);
      const arm = extractArmoredPublicKey(record);
      if (arm) {
        directoryHit = { armored: arm, source: record && record.source ? String(record.source) : "directory lookup" };
        if (!parts.includes(arm)) parts.push(arm);
      }
    } catch (_) {
      // non-blocking
    }
  }

  const combinedArmored = parts.filter(Boolean).join("\n\n");
  return {
    senderEmail,
    combinedArmored,
    localIdentity: localIdentity || null,
    trustedContactRecord,
    directoryHit,
    attachmentArmoreds,
  };
}

async function pickArmoredKeyForSignerFingerprint(candidates, signerFingerprint) {
  if (!window.openpgp || !signerFingerprint) return null;
  const want = normalizeFingerprintHex(signerFingerprint);
  if (!want) return null;
  const list = Array.isArray(candidates) ? candidates : [];
  for (const entry of list) {
    if (!entry || !entry.armored) continue;
    try {
      const k = await window.openpgp.readKey({ armoredKey: entry.armored });
      const fp = normalizeFingerprintHex(String((k.getFingerprint && k.getFingerprint()) || ""));
      if (fp && (fp === want || (want.length >= 16 && fp.endsWith(want.slice(-16))))) {
        return entry;
      }
    } catch (_) {
      // ignore
    }
  }
  return null;
}

function mergeNestedSignatureVerification(outer, inner) {
  const o = outer && typeof outer === "object" ? outer : { status: "unsigned", signed: false };
  const i = inner && typeof inner === "object" ? inner : null;
  if (!i || !i.signed) return o;
  if (i.status === "verified") {
    return {
      ...i,
      signerFingerprint: i.signerFingerprint || o.signerFingerprint || "",
      signerKeyIDs: i.signerKeyIDs && i.signerKeyIDs.length ? i.signerKeyIDs : o.signerKeyIDs || [],
    };
  }
  if (o.status === "verified") return o;
  return i;
}

function describeSignatureState(signatureState) {
  const state = signatureState || {};
  switch (state.status) {
    case "checking":
      return {
        tone: "dim",
        label: "VERIFYING SIGNATURE",
        title: "Resolving sender key and checking the OpenPGP signature.",
      };
    case "verified":
      if (state.displayTrust === "trusted") {
        return {
          tone: "ok",
          label: "TRUSTED SIGNER",
          title: state.source ? `Signature verified; key is trusted (${state.source}).` : "Signature verified with a trusted key for this sender.",
        };
      }
      if (state.displayTrust === "untrusted") {
        return {
          tone: "warn",
          label: "UNTRUSTED SIGNER",
          title:
            state.trustHint ||
            "The signature checks out, but this key is not in your trusted contacts. Trust the sender key to treat future mail from this fingerprint as trusted.",
        };
      }
      return {
        tone: "ok",
        label: "SIGNATURE VERIFIED",
        title: state.source ? `Verified with ${state.source}.` : "OpenPGP signature verified.",
      };
    case "missing_public_key":
      return {
        tone: "warn",
        label: "SIGNER KEY UNAVAILABLE",
        title: state.error || "The message appears to be signed, but no trusted sender key was available.",
      };
    case "bad_signature":
      return {
        tone: "err",
        label: "BAD SIGNATURE",
        title: state.error || "The message signature could not be verified.",
      };
    case "unsigned":
      return {
        tone: "dim",
        label: "UNSIGNED MESSAGE",
        title: "No OpenPGP signature was found on this decrypted message.",
      };
    case "error":
      return {
        tone: "warn",
        label: "SIGNATURE UNKNOWN",
        title: state.error || "Signature verification could not be completed.",
      };
    default:
      return null;
  }
}

function decodeQuotedPrintable(text) {
  if (!text || text.indexOf("=") === -1) return text || "";
  const cleaned = String(text).replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(cleaned.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (_) {
    return cleaned;
  }
}

function decodeMailBody(body, transferEncoding) {
  const encoding = String(transferEncoding || "").trim().toLowerCase();
  if (!encoding || encoding === "7bit" || encoding === "8bit" || encoding === "binary") {
    return body;
  }
  if (encoding === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  if (encoding === "base64") {
    try {
      const binary = atob(String(body).replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (_) {
      return body;
    }
  }
  return body;
}

function decodeAttachmentBytes(body, transferEncoding) {
  const encoding = String(transferEncoding || "").trim().toLowerCase();
  if (encoding === "base64") {
    const binary = atob(String(body || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const raw = String(body || "");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i) & 0xff;
  return out;
}

function hexPreview(bytes, max = 24) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return "";
  return Array.from(bytes.subarray(0, Math.min(bytes.length, max)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function utf8Preview(bytes, max = 512) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return "";
  try {
    return new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.subarray(0, Math.min(bytes.length, max)))
      .replace(/\0/g, "\\0");
  } catch (_) {
    return "";
  }
}

function describeEncryptedBlob(blobBytes) {
  const bytes = blobBytes instanceof Uint8Array ? blobBytes : new Uint8Array(blobBytes || []);
  const trimmed = bytes.subarray(0, Math.min(bytes.length, 4096));
  const preview = utf8Preview(trimmed, trimmed.length);
  const normalized = preview.replace(/\r\n/g, "\n");
  const leadingPreview = normalized.trimStart();
  let firstNonWhitespaceByte = null;
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b !== 0x20 && b !== 0x09 && b !== 0x0d && b !== 0x0a) {
      firstNonWhitespaceByte = b;
      break;
    }
  }

  const looksArmoredMessage = /^-----BEGIN PGP MESSAGE-----/.test(leadingPreview);
  const looksSignedMessage = /^-----BEGIN PGP SIGNED MESSAGE-----/.test(leadingPreview);
  const looksMimeHeaders = /^(mime-version:|content-type:|from:|to:|subject:|date:)/im.test(normalized);
  const contentTypeMatch = normalized.match(/content-type:\s*([^\n;]+)/i);
  const boundaryMatch = normalized.match(/boundary="?([^"\n;]+)"?/i);
  const looksPGPMime =
    /multipart\/encrypted/i.test(normalized) &&
    /application\/pgp-encrypted/i.test(normalized);
  const looksBinaryOpenPGP =
    firstNonWhitespaceByte !== null &&
    (firstNonWhitespaceByte >= 0xc0 || (firstNonWhitespaceByte & 0xc0) === 0x80);

  let detectedKind = "unknown";
  let hint = "Blob does not clearly look like armored or binary OpenPGP ciphertext.";
  if (looksArmoredMessage) {
    detectedKind = "armored-openpgp-message";
    hint = "Blob looks like ASCII-armored OpenPGP and should be parseable by openpgp.readMessage.";
  } else if (looksSignedMessage) {
    detectedKind = "pgp-signed-message";
    hint = "Blob looks like a signed cleartext message, not an encrypted OpenPGP message.";
  } else if (looksPGPMime) {
    detectedKind = "pgp-mime-message";
    hint = "Blob looks like full PGP/MIME email. openpgp.readMessage expects the encrypted payload part, not the outer multipart MIME wrapper.";
  } else if (looksBinaryOpenPGP) {
    detectedKind = "binary-openpgp-packets";
    hint = "Blob starts like binary OpenPGP packets and should be parseable as binaryMessage.";
  } else if (looksMimeHeaders) {
    detectedKind = "mime-message";
    hint = "Blob looks like an RFC 822/MIME message rather than raw OpenPGP ciphertext.";
  }

  return {
    byteLength: bytes.length,
    detectedKind,
    looksArmoredMessage,
    looksSignedMessage,
    looksPGPMime,
    looksMimeHeaders,
    looksBinaryOpenPGP,
    contentType: contentTypeMatch ? contentTypeMatch[1].trim() : "",
    boundary: boundaryMatch ? boundaryMatch[1] : "",
    firstNonWhitespaceByte,
    firstBytesHex: hexPreview(bytes),
    utf8Preview: preview,
    hint,
  };
}

function parseHeaderBlock(headerBlock) {
  const headerLines = String(headerBlock || "").split("\n");
  let totalHeaders = 0;
  let knownHeaders = 0;
  const headers = {};
  let currentHeader = "";
  for (const line of headerLines) {
    if (!line) return { headers: null, totalHeaders: 0, knownHeaders: 0 };
    if (/^[ \t]/.test(line)) {
      if (!currentHeader) return { headers: null, totalHeaders: 0, knownHeaders: 0 };
      headers[currentHeader] += " " + line.trim();
      continue;
    }
    const match = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!match) return { headers: null, totalHeaders: 0, knownHeaders: 0 };
    currentHeader = match[1].toLowerCase();
    headers[currentHeader] = match[2];
    totalHeaders += 1;
    if ([
      "from",
      "to",
      "cc",
      "subject",
      "date",
      "message-id",
      "in-reply-to",
      "references",
      "reply-to",
      "mime-version",
      "content-type",
      "content-transfer-encoding",
      "content-disposition",
    ].includes(currentHeader)) {
      knownHeaders += 1;
    }
  }
  return { headers, totalHeaders, knownHeaders };
}

function splitMultipartBody(body, boundary) {
  const marker = `--${boundary}`;
  const out = [];
  for (const rawPart of String(body || "").split(marker)) {
    let part = rawPart.trim();
    if (!part || part === "--") continue;
    if (part.endsWith("--")) part = part.slice(0, -2).trim();
    if (part) out.push(part);
  }
  return out;
}

function scoreBodyText(contentType, bodyText) {
  if (!String(bodyText || "").trim()) return 0;
  const kind = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (kind === "text/plain") return 3;
  if (kind === "text/html") return 2;
  if (kind.startsWith("text/")) return 1;
  return 0;
}

function parseMimeEntity(headers, body, depth = 0) {
  const normalizedBody = String(body || "");
  const contentType = String(headers && headers["content-type"] || "");
  const disposition = String(headers && headers["content-disposition"] || "");
  const transferEncoding = headers && headers["content-transfer-encoding"];
  const kind = contentType.split(";")[0].trim().toLowerCase();
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i) || contentType.match(/name="?([^"]+)"?/i);
  const filename = filenameMatch ? filenameMatch[1] : "";
  const isPGPSignaturePart =
    kind === "application/pgp-signature" ||
    kind === "application/x-pgp-signature";
  const isAttachment =
    !isPGPSignaturePart &&
    (/attachment/i.test(disposition) ||
    (!!filename && !kind.startsWith("multipart/") && kind !== "text/plain" && kind !== "text/html"));

  if (isAttachment) {
    return {
      bodyText: "",
      bodyHtml: "",
      bodyScore: 0,
      attachments: [{
        file_name: filename || "attachment.bin",
        content_type: kind || "application/octet-stream",
        bytes: decodeAttachmentBytes(normalizedBody, transferEncoding),
      }],
    };
  }

  if (depth < 8 && kind.startsWith("multipart/")) {
    const boundaryMatch = contentType.match(/boundary="?([^";\n]+)"?/i);
    if (boundaryMatch) {
      if (kind === "multipart/signed") {
        const protocolMatch = String(contentType).match(/protocol\s*=\s*"?([^";\s]+)"?/i);
        const protocol = protocolMatch ? protocolMatch[1].trim().toLowerCase() : "";
        if (/application\/(pgp|x-pgp)-signature/i.test(protocol)) {
          const parts = splitMultipartBody(normalizedBody, boundaryMatch[1]);
          if (parts.length > 0) {
            const first = parts[0];
            const partSep = first.indexOf("\n\n");
            if (partSep > 0) {
              const parsed = parseHeaderBlock(first.slice(0, partSep));
              if (parsed.headers) {
                return parseMimeEntity(parsed.headers, first.slice(partSep + 2), depth + 1);
              }
            }
          }
          return { bodyText: "", bodyHtml: "", bodyScore: 0, attachments: [] };
        }
      }
      let bestText = "";
      let bestScore = 0;
      let lastHtml = "";
      const attachments = [];
      for (const part of splitMultipartBody(normalizedBody, boundaryMatch[1])) {
        const partSep = part.indexOf("\n\n");
        if (partSep <= 0) continue;
        const parsed = parseHeaderBlock(part.slice(0, partSep));
        if (!parsed.headers) continue;
        const child = parseMimeEntity(parsed.headers, part.slice(partSep + 2), depth + 1);
        attachments.push(...child.attachments);
        if (child.bodyHtml && String(child.bodyHtml).trim()) {
          lastHtml = child.bodyHtml;
        }
        if (child.bodyScore > bestScore) {
          bestText = child.bodyText;
          bestScore = child.bodyScore;
        }
      }
      return {
        bodyText: bestText,
        bodyHtml: lastHtml,
        bodyScore: bestScore,
        attachments,
      };
    }
  }

  const decodedBody = decodeMailBody(normalizedBody, transferEncoding);
  if (kind === "text/html") {
    const text = htmlToDisplayText(decodedBody);
    return {
      bodyText: text,
      bodyHtml: decodedBody,
      bodyScore: scoreBodyText(kind, text),
      attachments: [],
    };
  }
  if (kind.startsWith("text/") || !kind) {
    return {
      bodyText: decodedBody,
      bodyHtml: "",
      bodyScore: scoreBodyText(kind || "text/plain", decodedBody),
      attachments: [],
    };
  }
  return { bodyText: "", bodyHtml: "", bodyScore: 0, attachments: [] };
}

function extractDisplayEnvelope(text) {
  if (typeof text !== "string" || !text) return { bodyText: text || "", bodyHtml: "", attachments: [] };
  const normalized = text.replace(/\r\n/g, "\n");
  const separatorIndex = normalized.indexOf("\n\n");
  if (separatorIndex <= 0) return { bodyText: text || "", bodyHtml: "", attachments: [] };

  const headerBlock = normalized.slice(0, separatorIndex);
  if (!headerBlock || headerBlock.length > (32 * 1024)) return { bodyText: text || "", bodyHtml: "", attachments: [] };
  const parsed = parseHeaderBlock(headerBlock);
  if (!looksLikeDisplayableEnvelope(parsed)) {
    return { bodyText: text || "", bodyHtml: "", attachments: [] };
  }
  const body = normalized.slice(separatorIndex + 2);
  const envelope = parseMimeEntity(parsed.headers, body);
  const contentType = String(parsed.headers["content-type"] || "").toLowerCase();
  if (envelope.bodyScore > 0 || envelope.attachments.length > 0 || contentType.startsWith("multipart/")) {
    return {
      bodyText: envelope.bodyText || "",
      bodyHtml: envelope.bodyHtml || "",
      attachments: envelope.attachments,
    };
  }
  return {
    bodyText: decodeMailBody(body, parsed.headers["content-transfer-encoding"]),
    bodyHtml: "",
    attachments: [],
  };
}

function extractDisplayBody(text) {
  return extractDisplayEnvelope(text).bodyText;
}

function looksLikeFullMessageHeaders(parsed) {
  return !!(parsed && parsed.headers && parsed.totalHeaders >= 2 && parsed.knownHeaders >= 2);
}

function looksLikeMimeEntityHeaders(parsed) {
  const headers = parsed && parsed.headers ? parsed.headers : null;
  if (!headers) return false;
  const contentType = String(headers["content-type"] || "").trim().toLowerCase();
  const transferEncoding = String(headers["content-transfer-encoding"] || "").trim().toLowerCase();
  const disposition = String(headers["content-disposition"] || "").trim().toLowerCase();
  if (!contentType) return false;
  return (
    contentType.startsWith("multipart/") ||
    contentType.startsWith("text/") ||
    disposition.includes("attachment") ||
    transferEncoding === "base64" ||
    transferEncoding === "quoted-printable"
  );
}

function looksLikeDisplayableEnvelope(parsed) {
  return looksLikeFullMessageHeaders(parsed) || looksLikeMimeEntityHeaders(parsed);
}

function makePreviewSnippet(text, max = 240) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Split To/Cc on commas not inside angle brackets (handles "Name" <a@b>, c@d). */
function splitMailAddressListHeader(value) {
  const raw = String(value || "").replace(/\r\n/g, "\n").replace(/\n/g, " ").trim();
  if (!raw) return [];
  let depth = 0;
  let cur = "";
  const parts = [];
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (c === "\"") {
      cur += c;
      continue;
    }
    if (c === "<") depth += 1;
    else if (c === ">") depth = Math.max(0, depth - 1);
    if (c === "," && depth === 0) {
      const t = cur.replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
      cur = "";
      continue;
    }
    cur += c;
  }
  const t = cur.replace(/\s+/g, " ").trim();
  if (t) parts.push(t);
  return parts;
}

function normalizeAngleMessageId(mid) {
  let s = String(mid || "").trim();
  if (!s) return "";
  if (!s.startsWith("<") && s.includes("@")) s = `<${s}>`;
  return s;
}

function extractDecryptedMessageMetadata(text, envelopeOptional) {
  if (typeof text !== "string" || !text) return null;
  const normalized = text.replace(/\r\n/g, "\n");
  const separatorIndex = normalized.indexOf("\n\n");
  if (separatorIndex <= 0) return null;
  const headerBlock = normalized.slice(0, separatorIndex);
  const parsed = parseHeaderBlock(headerBlock);
  if (!looksLikeFullMessageHeaders(parsed)) return null;
  const envelope = envelopeOptional || extractDisplayEnvelope(text);
  const toHeader = String(parsed.headers["to"] || "").replace(/\s+/g, " ").trim();
  const ccHeader = String(parsed.headers["cc"] || "").replace(/\s+/g, " ").trim();
  const toParts = splitMailAddressListHeader(toHeader);
  const ccParts = splitMailAddressListHeader(ccHeader);
  const rfcMessageId = normalizeAngleMessageId(parsed.headers["message-id"] || "");
  return {
    subject: String(parsed.headers["subject"] || "").trim(),
    from_addr: String(parsed.headers["from"] || "").replace(/\s+/g, " ").trim(),
    to_addrs: toParts.length > 0 ? toParts : (toHeader ? [toHeader] : []),
    cc_addrs: ccParts,
    rfc_message_id: rfcMessageId,
    in_reply_to: String(parsed.headers["in-reply-to"] || "").replace(/\s+/g, " ").trim(),
    references: String(parsed.headers["references"] || "").replace(/\s+/g, " ").trim(),
    reply_to: String(parsed.headers["reply-to"] || "").replace(/\s+/g, " ").trim(),
    preview: makePreviewSnippet(envelope && envelope.bodyText),
    attachments: envelope && Array.isArray(envelope.attachments) ? envelope.attachments : [],
  };
}

function replySubjectLine(subj) {
  const s = String(subj || "").trim();
  if (!s) return "Re: ";
  if (/^re:\s*/i.test(s)) return s;
  return `Re: ${s}`;
}

function formatQuotedReplyBodyHtml(plain) {
  const t = String(plain || "").trimEnd();
  if (!t) return "<p><br></p>";
  const escape = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p><br></p><blockquote>${t.split("\n").map((line) => escape(line)).join("<br>")}</blockquote>`;
}

function referencesChainForReply(message) {
  const tokens = String(message.references || "").trim().split(/\s+/).filter(Boolean);
  const mid = String(message.rfc_message_id || "").trim();
  if (mid && !tokens.includes(mid)) tokens.push(mid);
  let out = tokens.join(" ");
  if (out.length > 4000) out = out.slice(out.length - 4000).trim();
  return out;
}

function inReplyToForReply(message) {
  const m = String(message.rfc_message_id || "").trim();
  if (m) return m.startsWith("<") ? m : `<${m}>`;
  const t = String(message.thread_id || "").trim();
  if (!t) return "";
  return t.startsWith("<") ? t : `<${t}>`;
}

function buildReplyComposeDraft(message, identities, accountEmail, replyAll) {
  const self = new Set();
  const ae = canonicalizeSenderId(accountEmail);
  if (ae) self.add(ae);
  for (const idn of identities || []) {
    const e = canonicalizeSenderId(idn && idn.email);
    if (e) self.add(e);
  }
  const fromDisp = String(message.from_addr || "").trim();
  const fromCanon = canonicalizeSenderId(fromDisp);
  const replyToRaw = String(message.reply_to || "").trim();
  let toDisp = "";
  const ccParts = [];
  const outgoing = !!(fromCanon && self.has(fromCanon));
  if (outgoing) {
    const others = (Array.isArray(message.to_addrs) ? message.to_addrs : []).filter((d) => !self.has(canonicalizeSenderId(d)));
    toDisp = others.map((d) => String(d).trim()).filter(Boolean).join(", ");
    if (!toDisp) toDisp = fromDisp;
    if (replyAll) {
      const onTo = new Set(splitMailAddressListHeader(toDisp).map(canonicalizeSenderId).filter(Boolean));
      for (const d of Array.isArray(message.cc_addrs) ? message.cc_addrs : []) {
        const c = canonicalizeSenderId(d);
        if (!c || self.has(c) || onTo.has(c)) continue;
        onTo.add(c);
        ccParts.push(d);
      }
    }
  } else {
    toDisp = replyToRaw || fromDisp;
    if (replyAll) {
      const onTo = new Set(splitMailAddressListHeader(toDisp).map(canonicalizeSenderId).filter(Boolean));
      for (const d of [...(Array.isArray(message.to_addrs) ? message.to_addrs : []), ...(Array.isArray(message.cc_addrs) ? message.cc_addrs : [])]) {
        const c = canonicalizeSenderId(d);
        if (!c || self.has(c) || onTo.has(c)) continue;
        onTo.add(c);
        ccParts.push(d);
      }
    }
  }
  const ccStr = ccParts.map((d) => String(d).trim()).filter(Boolean).join(", ");
  return {
    to: toDisp,
    cc: ccStr,
    bcc: "",
    subject: replySubjectLine(message.subject),
    bodyHtml: "<p><br></p>",
    inReplyTo: inReplyToForReply(message),
    references: referencesChainForReply(message),
    showCc: !!replyAll,
  };
}

function mergeRecoveredMessageData(message, recovered) {
  if (!message || !recovered) return message;
  const nextAttachments = Array.isArray(recovered.attachments) && recovered.attachments.length > 0
    ? recovered.attachments
    : message.attachments;
  const recoveredSubject = normalizeRecoveredSubject(recovered.subject);
  const recoveredFrom = normalizeRecoveredAddress(recovered.from_addr);
  const recoveredTo = Array.isArray(recovered.to_addrs)
    ? recovered.to_addrs.map(normalizeRecoveredAddress).filter(Boolean)
    : [];
  const recoveredCc = Array.isArray(recovered.cc_addrs)
    ? recovered.cc_addrs.map(normalizeRecoveredAddress).filter(Boolean)
    : [];
  return {
    ...message,
    subject: recoveredSubject || message.subject,
    from_addr: recoveredFrom || message.from_addr,
    to_addrs: recoveredTo.length > 0 ? recoveredTo : message.to_addrs,
    cc_addrs: recoveredCc.length > 0 ? recoveredCc : (message.cc_addrs || []),
    rfc_message_id: recovered.rfc_message_id || message.rfc_message_id || "",
    in_reply_to: recovered.in_reply_to != null && String(recovered.in_reply_to).trim()
      ? recovered.in_reply_to
      : (message.in_reply_to || ""),
    references: recovered.references != null && String(recovered.references).trim()
      ? recovered.references
      : (message.references || ""),
    reply_to: recovered.reply_to != null && String(recovered.reply_to).trim()
      ? recovered.reply_to
      : (message.reply_to || ""),
    preview: recovered.preview || message.preview,
    attachments: nextAttachments,
    has_attachments: message.has_attachments || (Array.isArray(nextAttachments) && nextAttachments.length > 0),
    headerDecrypted: true,
  };
}

function isProtectedSubjectPlaceholder(subject) {
  const normalized = String(subject || "").trim().toLowerCase();
  return !normalized || normalized === "..." || normalized === "encrypted message";
}

/** Decode RFC 2047 encoded-words (=?charset?B|Q?...?=) in a header fragment for display. */
function decodeRFC2047Word(charsetRaw, encodingRaw, payloadRaw) {
  const charset = String(charsetRaw || "UTF-8").trim().replace(/_/g, "-").toLowerCase();
  const encoding = String(encodingRaw || "").toUpperCase();
  let bytes;
  if (encoding === "B") {
    try {
      const bin = atob(String(payloadRaw).replace(/\s+/g, ""));
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    } catch (_) {
      return null;
    }
  } else if (encoding === "Q") {
    const t = String(payloadRaw).replace(/_/g, " ");
    const out = [];
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
        out.push(parseInt(t.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        out.push(t.charCodeAt(i) & 0xff);
      }
    }
    bytes = new Uint8Array(out);
  } else {
    return null;
  }
  const label = charset === "utf8" ? "utf-8" : charset;
  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch (_) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch (_) {
      return null;
    }
  }
}

function decodeRFC2047HeaderDisplay(raw) {
  const input = String(raw || "");
  if (!input.includes("=?")) return input;
  const word = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
  return input.replace(word, (full, charset, enc, payload) => {
    const decoded = decodeRFC2047Word(charset, enc, payload);
    return decoded != null ? decoded : full;
  });
}

function normalizeRecoveredSubject(subject) {
  const normalized = decodeRFC2047HeaderDisplay(String(subject || "")).trim();
  return isProtectedSubjectPlaceholder(normalized) ? "" : normalized;
}

function normalizeRecoveredAddress(value) {
  const normalized = decodeRFC2047HeaderDisplay(String(value || "")).replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "[encrypted header]" || normalized === "(missing from)") return "";
  return normalized;
}

function hasMeaningfulRecipients(addrs) {
  return Array.isArray(addrs) && addrs.map(normalizeRecoveredAddress).filter(Boolean).length > 0;
}

function shouldRecoverMetadataFromBody(message) {
  if (!message || String(message.provenance || "") !== "already_encrypted") return false;
  return !normalizeRecoveredSubject(message.subject) || !normalizeRecoveredAddress(message.from_addr) || !hasMeaningfulRecipients(message.to_addrs);
}

function normalizeAttachmentSummary(attachment) {
  if (!attachment) return null;
  const fileName = attachment.file_name || attachment.fileName || "attachment.bin";
  const contentType = attachment.content_type || attachment.contentType || "application/octet-stream";
  const sizeBytes = Number(
    attachment.size_bytes != null
      ? attachment.size_bytes
      : (attachment.bytes && attachment.bytes.length ? attachment.bytes.length : 0)
  ) || 0;
  return {
    file_name: fileName,
    content_type: contentType,
    size_bytes: sizeBytes,
  };
}

function buildRecoveredHeaderPayload(recovered, envelopeOptional) {
  if (!recovered && !envelopeOptional) return null;
  const subject = normalizeRecoveredSubject(recovered && recovered.subject);
  const fromAddr = normalizeRecoveredAddress(recovered && recovered.from_addr);
  const toAddrs = Array.isArray(recovered && recovered.to_addrs)
    ? recovered.to_addrs.map(normalizeRecoveredAddress).filter(Boolean)
    : [];
  const attachments = Array.isArray(recovered && recovered.attachments)
    ? recovered.attachments.map(normalizeAttachmentSummary).filter(Boolean)
    : (envelopeOptional && Array.isArray(envelopeOptional.attachments)
      ? envelopeOptional.attachments.map(normalizeAttachmentSummary).filter(Boolean)
      : []);
  const preview = recovered && recovered.preview
    ? recovered.preview
    : makePreviewSnippet(envelopeOptional && envelopeOptional.bodyText);
  const ccAddrs = Array.isArray(recovered && recovered.cc_addrs)
    ? recovered.cc_addrs.map(normalizeRecoveredAddress).filter(Boolean)
    : [];
  return {
    subject,
    from_addr: fromAddr,
    to_addrs: toAddrs,
    cc_addrs: ccAddrs,
    rfc_message_id: (recovered && recovered.rfc_message_id) || "",
    in_reply_to: (recovered && recovered.in_reply_to) || "",
    references: (recovered && recovered.references) || "",
    reply_to: (recovered && recovered.reply_to) || "",
    preview,
    attachments,
  };
}

function buildCachedEnvelopePayload(envelope, recovered) {
  if (!envelope) return null;
  return {
    bodyText: envelope.bodyText || "",
    bodyHtml: envelope.bodyHtml || "",
    attachments: Array.isArray(envelope.attachments)
      ? envelope.attachments.map(normalizeAttachmentSummary).filter(Boolean)
      : [],
    recovered: buildRecoveredHeaderPayload(recovered, envelope),
  };
}

function inflateCachedEnvelopePayload(payload) {
  if (!payload) return null;
  return {
    bodyText: payload.bodyText || "",
    bodyHtml: payload.bodyHtml || "",
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments.map((attachment) => ({
          ...attachment,
          bytes: attachment.bytes || null,
        }))
      : [],
    recovered: payload.recovered || null,
  };
}

/** Envelopes persisted to IDB strip binary attachment payloads; those cache hits cannot satisfy download / size UI. */
function envelopeHasHydratedAttachmentBytes(envelope) {
  const list = envelope && Array.isArray(envelope.attachments) ? envelope.attachments : [];
  if (!list.length) return true;
  return list.every((a) => a && a.bytes instanceof Uint8Array);
}

async function persistRecoveredArtifacts(message, recovered, envelope, decryptFingerprint) {
  const cache = window.ElvishMailCache;
  const version = cache && typeof cache.extractVersion === "function" ? cache.extractVersion(message) : "";
  const headerPayload = buildRecoveredHeaderPayload(recovered, envelope);
  if (!headerPayload) return;
  if (cache && version && typeof cache.putHeader === "function") {
    await cache.putHeader(message.id, version, headerPayload);
  }
  if (cache && version && envelope && typeof cache.putEnvelope === "function") {
    const envelopePayload = buildCachedEnvelopePayload(envelope, recovered);
    if (envelopePayload) await cache.putEnvelope(message.id, version, envelopePayload);
  }
  const hasMeaningfulHeader =
    !!headerPayload.subject ||
    !!headerPayload.from_addr ||
    (Array.isArray(headerPayload.to_addrs) && headerPayload.to_addrs.length > 0);
  if (!recovered || !hasMeaningfulHeader) return;
  if (!decryptFingerprint || !window.ElvishKeyVault || !window.ElvishMailManifest) return;
  const ident = window.ElvishKeyVault.getIdentity(decryptFingerprint);
  if (!ident || !ident.armoredPub) return;
  const headerStub = {
    subject: headerPayload.subject || "",
    from: headerPayload.from_addr || "",
    to: headerPayload.to_addrs || [],
    cc: Array.isArray(headerPayload.cc_addrs) ? headerPayload.cc_addrs : [],
    preview: headerPayload.preview || "",
    attachments: Array.isArray(headerPayload.attachments) ? headerPayload.attachments : [],
    rfc_message_id: headerPayload.rfc_message_id || "",
    in_reply_to: headerPayload.in_reply_to || "",
    references: headerPayload.references || "",
    reply_to: headerPayload.reply_to || "",
  };
  const armored = await window.ElvishKeyVault.encryptToRecipient(ident.armoredPub, JSON.stringify(headerStub));
  const ciphertextB64 = window.ElvishMailManifest.bytesToBase64(new TextEncoder().encode(armored));
  await window.ElvishMailManifest.refreshMessageHeader(message.id, ciphertextB64);
}

async function decryptMessageBlobLocally(blob, identities) {
  if (!window.ElvishKeyVault) throw new Error("key vault unavailable");
  try {
    return await window.ElvishKeyVault.tryDefaultDecrypt(blob);
  } catch (e) {
    let lastErr = e;
    const fps = (identities || []).map((i) => i.fingerprint);
    for (const fp of fps) {
      try {
        const text = await window.ElvishKeyVault.decryptToString(blob, fp);
        return { data: text, fingerprint: fp };
      } catch (er) {
        lastErr = er;
      }
    }
    throw lastErr || new Error("no identity decrypts message");
  }
}

function Sidebar({
  folder,
  setFolder,
  onCompose,
  onCreateDisposable,
  onCopyDisposable,
  creatingDisposable,
  latestDisposable,
  folderCounts,
  view,
  onViewChange,
  user,
  vaultUnlocked,
  onVaultClick,
  isAdmin,
}) {
  const logoutFormRef = useRef(null);

  const handleLogout = useCallback(() => {
    if (window.ElvishKeyVault) window.ElvishKeyVault.zero({ clearTrustedDevice: true });
    logoutFormRef.current?.submit();
  }, []);

  return (
    <aside className="mail-sidebar">
      <div className="mail-sidebar-brand">
        <a href="/" className="mail-brand-link">
          <span className="mail-brand-dot"></span>
          <span className="mail-brand-text">ELVISH</span>
        </a>
        <span className="mail-brand-section">MAIL</span>
      </div>

      <div className="mail-sidebar-header">
        <button className="mail-compose-btn" onClick={onCompose}>{Icons.plus}<span>Compose</span></button>
      </div>

      <nav className="mail-folders">
        <div className="mail-folder-section">Mailbox</div>
        {FOLDERS.map((f) => (
          <div
            key={f.id}
            className={`mail-folder ${view === "mail" && folder === f.id ? "active" : ""}`}
            onClick={() => { onViewChange("mail"); setFolder(f.id); }}
          >
            <span className="mail-folder-icon">{Icons[f.icon]}</span>
            <span className="mail-folder-name">{f.name}</span>
            {(folderCounts && folderCounts[f.id] > 0) ? <span className="mail-folder-count">{folderCounts[f.id]}</span> : null}
          </div>
        ))}

        <div className="mail-folder-section">Account</div>
        <div
          className={`mail-folder ${view === "settings" ? "active" : ""}`}
          onClick={() => onViewChange("settings")}
        >
          <span className="mail-folder-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span className="mail-folder-name">Settings</span>
        </div>
        {isAdmin && (
          <a
            className="mail-folder"
            href={(typeof window !== "undefined" && window.ELVISH_CONSOLE_ORIGIN) || "http://127.0.0.1:8780"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="mail-folder-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </span>
            <span className="mail-folder-name">Console</span>
          </a>
        )}
      </nav>

      <div className="mail-sidebar-disposable">
        <div className="mail-folder-section" style={{ padding: 0, marginBottom: 8 }}>Disposable</div>
        <button className="mail-sidebar-action" onClick={onCreateDisposable} disabled={creatingDisposable}>
          {Icons.plus}
          <span>{creatingDisposable ? "Generating..." : "Create Address"}</span>
        </button>
        {latestDisposable && (
          <button className="mail-sidebar-generated" onClick={() => onCopyDisposable(latestDisposable)} title="Click to copy">
            <span className="mail-sidebar-generated-email">{latestDisposable}</span>
            <span className="mail-sidebar-generated-copy">Click to copy</span>
          </button>
        )}
      </div>

      <div className="mail-sidebar-bottom">
        <button
          className={`mail-sidebar-vault ${vaultUnlocked ? "unlocked" : "locked"}`}
          onClick={onVaultClick}
          title={vaultUnlocked ? "Vault unlocked — click to lock" : "Vault locked — click to unlock"}
        >
          {Icons.lock}
          <span>{vaultUnlocked ? "Vault Unlocked" : "Vault Locked"}</span>
        </button>

        <div className="mail-sidebar-user">
          <span className="mail-sidebar-user-email" title={user?.email}>
            {user?.email || "User"}
          </span>
          <button className="mail-sidebar-logout" onClick={handleLogout} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        <form
          ref={logoutFormRef}
          action="/auth/logout"
          method="post"
          style={{ display: "none" }}
        >
          <input type="hidden" name="next" value="/mail" />
        </form>
      </div>
    </aside>
  );
}

function MessageDetail({ message, identities, unlocked, onMetadataRecovered, onComposeReply }) {
  const [bodyText, setBodyText] = useState(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyView, setBodyView] = useState("plain");
  const [attachments, setAttachments] = useState([]);
  const [bodyErr, setBodyErr] = useState("");
  const [signatureState, setSignatureState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [trustBusy, setTrustBusy] = useState(false);
  const [trustErr, setTrustErr] = useState("");
  const attemptedMessageRef = useRef("");
  const htmlIframeRef = useRef(null);
  const verificationRunRef = useRef(0);
  const lastSigBlobRef = useRef(null);
  const lastSigDecryptFingerprintRef = useRef("");
  const lastSigFromAddrRef = useRef("");
  const lastSigAttachmentsRef = useRef([]);

  useEffect(() => {
    setBodyText(null);
    setBodyHtml("");
    setBodyView("plain");
    setAttachments([]);
    setBodyErr("");
    setSignatureState(null);
    setTrustErr("");
    attemptedMessageRef.current = "";
    verificationRunRef.current += 1;
  }, [message && message.id]);

  const verifyBodySignature = useCallback(async ({ blob, decryptFingerprint, fromAddr, attachments }) => {
    if (!blob || !decryptFingerprint || !window.ElvishKeyVault || typeof window.ElvishKeyVault.decryptForIdentityResult !== "function") {
      setSignatureState(null);
      return;
    }
    lastSigBlobRef.current = blob;
    lastSigDecryptFingerprintRef.current = decryptFingerprint;
    lastSigFromAddrRef.current = fromAddr || "";
    lastSigAttachmentsRef.current = Array.isArray(attachments) ? attachments : [];

    const runID = verificationRunRef.current + 1;
    verificationRunRef.current = runID;
    setSignatureState({ status: "checking" });
    try {
      const attArmored = extractPublicKeysFromMimeAttachments(lastSigAttachmentsRef.current);
      const bundle = await buildCombinedVerificationArmored(fromAddr, identities, attArmored);
      const verifyOpts = bundle.combinedArmored ? { armoredPublicKeys: bundle.combinedArmored } : undefined;
      const verificationResult = await window.ElvishKeyVault.decryptForIdentityResult(
        decryptFingerprint,
        blob,
        verifyOpts
      );
      if (verificationRunRef.current !== runID) return;
      let innerVerification = null;
      if (
        verificationResult &&
        verificationResult.data &&
        window.ElvishKeyVault &&
        typeof window.ElvishKeyVault.verifyNestedSignedPayloadAfterDecrypt === "function"
      ) {
        try {
          innerVerification = await window.ElvishKeyVault.verifyNestedSignedPayloadAfterDecrypt(
            verificationResult.data,
            verifyOpts || {},
          );
        } catch (_) {
          innerVerification = null;
        }
      }
      const outerV = verificationResult && verificationResult.verification ? verificationResult.verification : { status: "error", error: "signature result missing" };
      const merged = mergeNestedSignatureVerification(outerV, innerVerification);
      const senderEmail = bundle.senderEmail || canonicalizeSenderId(fromAddr);
      const signerFp = merged && merged.signerFingerprint ? String(merged.signerFingerprint) : "";
      let displayTrust = "na";
      let trustArmored = "";
      let trustSource = "";
      let trustHint = "";
      let sourceLabel = "";
      if (merged.status === "verified" && signerFp) {
        if (bundle.localIdentity && fingerprintsMatch(bundle.localIdentity.fingerprint, signerFp)) {
          displayTrust = "trusted";
          sourceLabel = "local identity";
        } else if (bundle.trustedContactRecord && fingerprintsMatch(bundle.trustedContactRecord.fingerprint, signerFp)) {
          displayTrust = "trusted";
          sourceLabel = "trusted contact";
        } else {
          displayTrust = "untrusted";
          const cands = [];
          for (const arm of bundle.attachmentArmoreds || []) {
            cands.push({ armored: arm, source: "message attachment" });
          }
          if (bundle.directoryHit && bundle.directoryHit.armored) {
            cands.push({
              armored: bundle.directoryHit.armored,
              source: bundle.directoryHit.source || "directory lookup",
            });
          }
          const pick = await pickArmoredKeyForSignerFingerprint(cands, signerFp);
          if (pick) {
            trustArmored = pick.armored;
            trustSource = pick.source || "import";
            trustHint = `Cryptographic signature OK using ${pick.source || "a supplied"} key — not in your trusted contacts yet.`;
          } else {
            trustHint =
              "Cryptographic signature OK, but the signing key is not trusted and no matching attachment or directory key was found to import.";
          }
        }
      }

      setSignatureState({
        ...merged,
        source: sourceLabel,
        senderEmail,
        displayTrust,
        trustArmored,
        trustSource,
        trustHint,
      });
    } catch (e) {
      if (verificationRunRef.current !== runID) return;
      setSignatureState({ status: "error", error: (e && e.message) || String(e) });
    }
  }, [identities]);

  const onTrustSigner = useCallback(async () => {
    const st = signatureState;
    if (!st || !st.trustArmored || !st.senderEmail || !window.ElvishMailManifest || typeof window.ElvishMailManifest.putContactKey !== "function") {
      return;
    }
    setTrustBusy(true);
    setTrustErr("");
    try {
      await window.ElvishMailManifest.putContactKey({
        email: st.senderEmail,
        armoredPublic: st.trustArmored,
        source: st.trustSource ? `trusted:${String(st.trustSource).slice(0, 48)}` : "message",
        trusted: true,
      });
      await verifyBodySignature({
        blob: lastSigBlobRef.current,
        decryptFingerprint: lastSigDecryptFingerprintRef.current,
        fromAddr: lastSigFromAddrRef.current,
        attachments: lastSigAttachmentsRef.current,
      });
    } catch (e) {
      setTrustErr((e && e.message) || String(e));
    } finally {
      setTrustBusy(false);
    }
  }, [signatureState, verifyBodySignature]);

  const decryptBody = useCallback(async () => {
    if (!message) return;
    const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    setBusy(true);
    setBodyErr("");
    let blob = null;
    try {
      const cache = window.ElvishMailCache;
      const version = cache && typeof cache.extractVersion === "function" ? cache.extractVersion(message) : "";
      if (cache && version && typeof cache.getEnvelope === "function" && typeof cache.unwrapVersionedPayload === "function") {
        const cachedEnvelopeEntry = await cache.getEnvelope(message.id);
        const cachedEnvelope = inflateCachedEnvelopePayload(cache.unwrapVersionedPayload(cachedEnvelopeEntry, version));
        if (cachedEnvelope && cachedEnvelope.bodyText != null && envelopeHasHydratedAttachmentBytes(cachedEnvelope)) {
          setBodyText(cachedEnvelope.bodyText || "");
          const html = String(cachedEnvelope.bodyHtml || "").trim();
          setBodyHtml(html);
          setBodyView(html ? "html" : "plain");
          setAttachments(cachedEnvelope.attachments || []);
          if (typeof onMetadataRecovered === "function" && cachedEnvelope.recovered) {
            onMetadataRecovered(message, cachedEnvelope.recovered, { envelope: cachedEnvelope, fromCache: true });
          }
          try {
            const sigBlob = await window.ElvishMailManifest.fetchBlob(message.id);
            const res = await decryptMessageBlobLocally(sigBlob, identities);
            const signatureFromAddr =
              (cachedEnvelope.recovered && cachedEnvelope.recovered.from_addr) || message.from_addr || "";
            void verifyBodySignature({
              blob: sigBlob,
              decryptFingerprint: res.fingerprint,
              fromAddr: signatureFromAddr,
              attachments: cachedEnvelope.attachments || [],
            });
          } catch (_) {
            // Signature pass is best-effort for cache hits.
          }
          if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "message_open", perfStartedAt, "success");
          return;
        }
      }
      blob = await window.ElvishMailManifest.fetchBlob(message.id);
      const res = await decryptMessageBlobLocally(blob, identities);
      const envelope = extractDisplayEnvelope(res.data || "");
      const recovered = extractDecryptedMessageMetadata(res.data || "", envelope);
      const signatureFromAddr = (recovered && recovered.from_addr) || message.from_addr || "";
      setBodyText(envelope.bodyText || "");
      const html = String(envelope.bodyHtml || "").trim();
      setBodyHtml(html);
      setBodyView(html ? "html" : "plain");
      setAttachments(envelope.attachments || []);
      if (typeof onMetadataRecovered === "function") {
        onMetadataRecovered(message, recovered, { envelope, decryptFingerprint: res.fingerprint });
      }
      void verifyBodySignature({
        blob,
        decryptFingerprint: res.fingerprint,
        fromAddr: signatureFromAddr,
        attachments: envelope.attachments || [],
      });
      if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "message_open", perfStartedAt, "success");
    } catch (e) {
      setBodyErr((e && e.message) || String(e));
      setSignatureState(null);
      const blobDebug = blob ? describeEncryptedBlob(blob) : null;
      if (typeof __ELVISH_DEBUG__ !== "undefined" && __ELVISH_DEBUG__) {
        console.groupCollapsed(`[mail] body decrypt failed ${String(message.id || "").slice(0, 8) || "(unknown)"}`);
        console.warn("mail message metadata", {
          id: message.id || "",
          provenance: message.provenance || "",
          subject: message.subject || "",
          from: message.from_addr || "",
          to: Array.isArray(message.to_addrs) ? message.to_addrs : [],
        });
        if (blobDebug) console.warn("mail ciphertext summary", blobDebug);
        console.warn("mail decrypt error", e);
        console.groupEnd();
      } else {
        console.warn("[mail] decrypt failed", { id: (message.id || "").slice(0, 8), err: (e && e.message) || String(e) });
      }
      if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "message_open", perfStartedAt, "failure");
    } finally {
      setBusy(false);
    }
  }, [message, identities, onMetadataRecovered, verifyBodySignature]);

  const downloadAttachment = useCallback((attachment) => {
    if (!attachment || !attachment.bytes) return;
    const blob = new Blob([attachment.bytes], { type: attachment.content_type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name || "attachment.bin";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  useEffect(() => {
    const messageID = (message && message.id) || "";
    if (!messageID || !unlocked || busy || bodyText !== null) return;
    if (attemptedMessageRef.current === messageID) return;
    attemptedMessageRef.current = messageID;
    void decryptBody();
  }, [message, unlocked, busy, bodyText, decryptBody]);

  const htmlSrcTrimmed = String(bodyHtml || "").trim();
  const hasDomPurify = typeof globalThis !== "undefined" && !!globalThis.DOMPurify;
  const canHtml = hasDomPurify && !!htmlSrcTrimmed;

  const sanitizedHtmlSrcDoc = useMemo(() => {
    const p = typeof globalThis !== "undefined" && globalThis.DOMPurify;
    const src = String(bodyHtml || "").trim();
    if (!p || !src) return "";
    return MAIL_HTML_IFRAME_DOC_PREFIX + p.sanitize(src) + MAIL_HTML_IFRAME_DOC_SUFFIX;
  }, [bodyHtml]);

  useLayoutEffect(() => {
    if (bodyView !== "html" || !sanitizedHtmlSrcDoc) return undefined;
    const iframe = htmlIframeRef.current;
    if (!iframe) return undefined;

    let cancelled = false;
    const outerDisposers = [];
    let innerCleanup = null;

    const cleanupInner = () => {
      if (typeof innerCleanup === "function") {
        try {
          innerCleanup();
        } catch (_) {
          /* ignore */
        }
        innerCleanup = null;
      }
    };

    const cleanupOuter = () => {
      cleanupInner();
      while (outerDisposers.length) {
        const fn = outerDisposers.pop();
        try {
          if (typeof fn === "function") fn();
        } catch (_) {
          /* ignore */
        }
      }
    };

    const applyHeight = () => {
      if (cancelled) return;
      const h = measureMailHtmlIframeContentHeight(iframe);
      if (h == null) return;
      const next = Math.min(Math.max(Math.ceil(h) + 12, 280), 50000);
      iframe.style.height = `${next}px`;
    };

    const attachObservers = () => {
      cleanupInner();
      if (cancelled) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.documentElement) return;
        const inner = [];
        const roDoc = new ResizeObserver(applyHeight);
        roDoc.observe(doc.documentElement);
        inner.push(() => roDoc.disconnect());
        const roIframe = new ResizeObserver(applyHeight);
        roIframe.observe(iframe);
        inner.push(() => roIframe.disconnect());
        const imgs = Array.from(doc.querySelectorAll("img"));
        for (const img of imgs) {
          const onImg = () => applyHeight();
          img.addEventListener("load", onImg);
          inner.push(() => img.removeEventListener("load", onImg));
        }
        applyHeight();
        innerCleanup = () => {
          while (inner.length) {
            const fn = inner.pop();
            try {
              if (typeof fn === "function") fn();
            } catch (_) {
              /* ignore */
            }
          }
        };
      } catch (_) {
        applyHeight();
      }
    };

    const onLoad = () => attachObservers();
    iframe.addEventListener("load", onLoad);
    outerDisposers.push(() => iframe.removeEventListener("load", onLoad));
    if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
      attachObservers();
    }

    return () => {
      cancelled = true;
      cleanupOuter();
    };
  }, [bodyView, sanitizedHtmlSrcDoc]);

  if (!message) {
    return (
      <div className="mail-detail">
        <div className="mail-detail-header">
          <span className="kind">▸ MAIL</span>
          <span className="title">Message</span>
          <span className="status">awaiting selection</span>
        </div>
        <div className="mail-detail-empty">
          <div className="glyph">{Icons.mail}</div>
          <div className="hint">Select a message to view</div>
        </div>
      </div>
    );
  }

  const signatureDisplay = describeSignatureState(signatureState);
  const encDisplay = messageEncryptionDisplay(message.provenance);

  return (
    <div className="mail-detail">
      <div className="mail-detail-header">
        <span className="kind">▸ MAIL</span>
        <span className="title">Message</span>
        <span className="status">ID {(message.id || "").slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="mail-detail-body">
        <div className="mail-msg-head">
          <h1 className="mail-msg-subject">{message.subject || "(no subject)"}</h1>
          <div className="mail-msg-meta">
            <span className="k">From</span>
            <span className="v">{message.from_addr || "[encrypted header]"}</span>
            <span className="k">To</span>
            <span className="v">{(message.to_addrs || []).join(", ") || "[encrypted header]"}</span>
            <span className="k">Date</span>
            <span className="v dim">{formatFullDate(message.received_at)}</span>
            <span className="k">Encryption</span>
            <span className="v dim" title={encDisplay.title}>{encDisplay.label}</span>
          </div>
          {typeof onComposeReply === "function" && (
            <div className="mail-msg-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  const plain = bodyText !== null ? htmlToDisplayText(bodyText) : "";
                  onComposeReply({ message, replyAll: false, plainBody: plain });
                }}
              >
                Reply
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  const plain = bodyText !== null ? htmlToDisplayText(bodyText) : "";
                  onComposeReply({ message, replyAll: true, plainBody: plain });
                }}
              >
                Reply all
              </button>
            </div>
          )}
        </div>
        <div className={`mail-security-strip mail-security-strip--${encDisplay.id}`}>
          <span className={`mail-security-item ${encDisplay.flagClass}`} title={encDisplay.title}>
            {Icons.lock}
            <span>{encDisplay.label}</span>
          </span>
          {signatureDisplay && (
            <span className={`mail-security-item ${signatureDisplay.tone}`} title={signatureDisplay.title}>
              {Icons.key}
              <span>{signatureDisplay.label}</span>
            </span>
          )}
        </div>
        {signatureState &&
          signatureState.displayTrust === "untrusted" &&
          signatureState.status === "verified" &&
          signatureState.trustArmored && (
            <div className="mail-trust-banner" role="region" aria-label="Trust sender key">
              <span className="dim tiny">
                Save this public key for <code className="mono">{signatureState.senderEmail || ""}</code> as a trusted contact to show &quot;trusted signer&quot; on future messages.
              </span>
              <button type="button" className="btn-sm primary" onClick={onTrustSigner} disabled={trustBusy}>
                {trustBusy ? "Saving…" : "▸ TRUST SENDER KEY"}
              </button>
              {trustErr ? <span className="mail-unlock-err">! {trustErr}</span> : null}
            </div>
          )}
        <div className="mail-msg-content">
          {attachments.length > 0 && (
            <div className="mail-attachments">
              <div className="mail-attachments-h">Attachments</div>
              {attachments.map((attachment, idx) => (
                <div key={`${attachment.file_name || "attachment"}-${idx}`} className="mail-attachment" onClick={() => downloadAttachment(attachment)}>
                  <div className="mail-attachment-icon">{Icons.attach}</div>
                  <div className="mail-attachment-info">
                    <div className="mail-attachment-name">{attachment.file_name || "attachment.bin"}</div>
                    <div className="mail-attachment-size">{formatAttachmentSize(attachment.bytes)}</div>
                  </div>
                  <div className="mail-attachment-action">Download</div>
                </div>
              ))}
            </div>
          )}
          {bodyText !== null ? (
            <>
              {canHtml ? (
                <div className="mail-body-view-tabs" role="tablist" aria-label="Message body view">
                  <button type="button" role="tab" aria-selected={bodyView === "plain"} className={`btn-sm ${bodyView === "plain" ? "primary" : ""}`} onClick={() => setBodyView("plain")}>Plain</button>
                  <button type="button" role="tab" aria-selected={bodyView === "html"} className={`btn-sm ${bodyView === "html" ? "primary" : ""}`} onClick={() => setBodyView("html")}>HTML</button>
                </div>
              ) : null}
              {bodyView === "html" && canHtml ? (
                <div className="mail-msg-html-shell">
                  <iframe
                    ref={htmlIframeRef}
                    title="Sanitized HTML preview"
                    className="mail-msg-html-frame"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={sanitizedHtmlSrcDoc}
                  />
                </div>
              ) : (
                <pre className="mail-msg-body">{bodyText}</pre>
              )}
            </>
          ) : (
            <div className="mail-decrypt-stage">
              {busy ? (
                <div
                  className="mail-decrypt-loading"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  aria-label="Decrypting message body"
                >
                  <div className="mail-decrypt-loading-mark" aria-hidden="true">
                    <span className="mail-decrypt-loading-icon">{Icons.lock}</span>
                    <span className="mail-decrypt-loading-spinner" />
                  </div>
                  <div className="mail-decrypt-loading-title">Decrypting message</div>
                  <p className="mail-decrypt-loading-sub">
                    Ciphertext is fetched from storage, then OpenPGP runs in this tab. Plaintext never
                    leaves your browser.
                  </p>
                  <div className="mail-decrypt-skeleton" aria-hidden="true">
                    <span className="mail-decrypt-skeleton-line w-92" />
                    <span className="mail-decrypt-skeleton-line w-78" />
                    <span className="mail-decrypt-skeleton-line w-88" />
                    <span className="mail-decrypt-skeleton-line w-64" />
                  </div>
                </div>
              ) : (
                <>
                  <pre className="mail-msg-body encrypted">
                    {unlocked
                      ? "// Encrypted body — decryption runs locally when you open the message."
                      : "// Encrypted body — unlock your key above, then decrypt here."}
                  </pre>
                  <div className="mail-decrypt-panel">
                    <div className="mail-decrypt-panel-h">Decrypt body</div>
                    <p className="mail-decrypt-panel-copy dim">
                      Body is fetched from object storage as PGP ciphertext and decrypted in-browser
                      with your unlocked identity. Plaintext never leaves this tab.
                    </p>
                    {bodyErr && <div className="mail-unlock-err">! {bodyErr}</div>}
                    <button className="btn-sm primary mail-decrypt-retry" onClick={decryptBody} disabled={busy}>
                      {bodyErr ? "▸ RETRY" : "▸ DECRYPT NOW"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (message) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [message, onClose]);
  if (!message) return null;
  return <div className={`mail-toast ${type || ""}`}>{message}</div>;
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel, confirmVariant, loading }) {
  if (!open) return null;
  return (
    <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="settings-modal settings-modal-sm">
        <div className="settings-modal-header">
          <h3>{title || "Confirm"}</h3>
          <button className="settings-modal-close" onClick={onClose} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="settings-modal-body">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--fg)" }}>{message}</p>
          <div className="settings-modal-actions">
            <button
              className="settings-btn settings-btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={`settings-btn settings-btn-${confirmVariant || "danger"}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "…" : (confirmLabel || "Confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetentionSetupModal({
  open,
  loading,
  inboxEnabled,
  inboxDays,
  accountDeleteEnabled,
  accountDeleteValue,
  accountDeleteUnit,
  onToggleInbox,
  onChangeDays,
  onToggleAccountDelete,
  onChangeAccountDeleteValue,
  onChangeAccountDeleteUnit,
  onSkip,
  onSave,
}) {
  if (!open) return null;
  return (
    <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onSkip(); }}>
      <div className="settings-modal settings-modal-md">
        <div className="settings-modal-header">
          <h3>Security Setup</h3>
        </div>
        <div className="settings-modal-body">
          <p style={{ marginTop: 0, fontSize: 13, lineHeight: 1.6 }}>
            Secure defaults are already applied: Sent auto-deletes after 30 days, Trash auto-deletes after 30 days,
            and Archive is kept until you choose otherwise.
          </p>
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <div className="settings-card-header">
              <div className="settings-card-header-text">
                <h3 className="settings-card-title">Inbox retention</h3>
                <p className="settings-card-description">Optionally auto-delete inbox mail after a chosen number of days.</p>
              </div>
            </div>
            <label className="settings-consent-toggle" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={!!inboxEnabled} onChange={(e) => onToggleInbox(e.target.checked)} disabled={loading} />
              <span className="settings-consent-label">Enable Inbox auto-delete</span>
            </label>
            <div className="settings-consent-row">
              <label className="settings-consent-label">Inbox retention (days)</label>
              <input
                type="number"
                min={1}
                max={3650}
                className="settings-input"
                style={{ maxWidth: 140 }}
                value={inboxEnabled ? inboxDays : ''}
                disabled={!inboxEnabled || loading}
                placeholder="days"
                onChange={(e) => onChangeDays(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-card" style={{ marginBottom: 16 }}>
            <div className="settings-card-header">
              <div className="settings-card-header-text">
                <h3 className="settings-card-title">Inactive account deletion</h3>
                <p className="settings-card-description">Optionally delete this account if it stays inactive for too long.</p>
              </div>
            </div>
            <label className="settings-consent-toggle" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={!!accountDeleteEnabled} onChange={(e) => onToggleAccountDelete(e.target.checked)} disabled={loading} />
              <span className="settings-consent-label">Delete this account after inactivity</span>
            </label>
            <div className="settings-consent-row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label className="settings-consent-label">Delete after</label>
              <input
                type="number"
                min={1}
                max={3650}
                className="settings-input"
                style={{ maxWidth: 120 }}
                value={accountDeleteEnabled ? accountDeleteValue : ""}
                disabled={!accountDeleteEnabled || loading}
                placeholder="value"
                onChange={(e) => onChangeAccountDeleteValue(e.target.value)}
              />
              <select
                className="settings-input"
                style={{ maxWidth: 160 }}
                value={accountDeleteUnit}
                disabled={!accountDeleteEnabled || loading}
                onChange={(e) => onChangeAccountDeleteUnit(e.target.value)}
              >
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </select>
            </div>
            <p className="settings-consent-help" style={{ marginBottom: 0 }}>
              We only keep the last online day for this policy, not a detailed activity history.
            </p>
          </div>

          <p className="settings-consent-help" style={{ marginTop: 0 }}>
            Sent and Trash already default to 30-day auto-delete, while Archive stays until you change it.
          </p>
          <p className="settings-consent-help" style={{ marginBottom: 0 }}>
            You can change both policies later in Settings.
          </p>
          <div className="settings-modal-actions">
            <button className="settings-btn settings-btn-secondary" onClick={onSkip} disabled={loading}>Use Secure Defaults</button>
            <button className="settings-btn settings-btn-primary" onClick={onSave} disabled={loading}>{loading ? "…" : "Save Setup"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyMailListSelection() {
  return { ids: [], anchorId: null, focusId: null };
}

function orderSelectedIdsByMessages(selectedSet, visibleMessages) {
  return visibleMessages.filter((m) => selectedSet.has(m.id)).map((m) => m.id);
}

function mailListSelectionAfterRemoving(prev, removedSet) {
  const ids = prev.ids.filter((id) => !removedSet.has(id));
  if (ids.length === 0) return emptyMailListSelection();
  let focusId = prev.focusId;
  if (removedSet.has(focusId)) focusId = ids[ids.length - 1] || null;
  let anchorId = prev.anchorId;
  if (!anchorId || removedSet.has(anchorId) || !ids.includes(anchorId)) anchorId = ids[0];
  return { ids, anchorId, focusId };
}

function MailApp() {
  const [me, setMe] = useState(null); // {email,...} | false (anon) | null (loading)
  const [view, setView] = useState("mail"); // 'mail' | 'settings' | 'admin'
  const [adminEmbedStatus, setAdminEmbedStatus] = useState("idle"); // idle|loading|ready|error
  const [adminEmbedFailReason, setAdminEmbedFailReason] = useState(null); // null|'forbidden'|'unknown'
  const adminEmbedScriptRef = useRef(false);
  const [settingsEmbedStatus, setSettingsEmbedStatus] = useState("idle"); // idle|loading|ready|error
  const settingsEmbedScriptRef = useRef(false);
  const [folder, setFolder] = useState("inbox");
  const [messages, setMessages] = useState([]);
  const [listSelection, setListSelection] = useState(() => emptyMailListSelection());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [hasMail, setHasMail] = useState(true); // false → /api/v1/mail returned 503
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState(null);
  const [searchReady, setSearchReady] = useState(false);
  const [mailCacheReady, setMailCacheReady] = useState(false);
  const [senderProfiles, setSenderProfiles] = useState(EMPTY_SENDER_PROFILES);
  const [creatingDisposable, setCreatingDisposable] = useState(false);
  const [latestDisposable, setLatestDisposable] = useState("");
  const [folderCounts, setFolderCounts] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [retentionSetupOpen, setRetentionSetupOpen] = useState(false);
  const [retentionSetupBusy, setRetentionSetupBusy] = useState(false);
  const [retentionSetupInboxEnabled, setRetentionSetupInboxEnabled] = useState(false);
  const [retentionSetupInboxDays, setRetentionSetupInboxDays] = useState(30);
  const [retentionSetupAccountDeleteEnabled, setRetentionSetupAccountDeleteEnabled] = useState(false);
  const [retentionSetupAccountDeleteValue, setRetentionSetupAccountDeleteValue] = useState(30);
  const [retentionSetupAccountDeleteUnit, setRetentionSetupAccountDeleteUnit] = useState("days");
  const readInFlightRef = useRef(new Set());
  const searchRef = useRef(null);
  const indexedMessagesRef = useRef(new Set());
  const retentionSetupHydratedRef = useRef(false);
  const recoveryInFlightRef = useRef(new Set());
  const recoveryAttemptVersionRef = useRef(new Map());
  const filterRunTimerRef = useRef(null);
  const filterRunGenRef = useRef(0);
  const folderLoadGenRef = useRef(0);
  const mailListRef = useRef(null);
  const listSelectionRef = useRef(emptyMailListSelection());
  listSelectionRef.current = listSelection;

  // Vault unlock guard hook (defined in unlock-modal.jsx).
  const guard = (window.useElvishUnlockGuard || (() => ({
    unlocked: true,
    vaultHydrated: true,
    modalOpen: false,
    idleLockout: false,
    openModal() {},
    closeModal() {},
    onUnlocked() {},
  })))(!!me, (me && me.email) || "");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-font", "ibm");
    if (window.ElvishPerf) {
      window.ElvishPerf.observePaint("mail_ui");
      window.ElvishPerf.recordSinceNavigation("mail_ui", "page_boot", "success");
    }
  }, []);

  useEffect(() => {
    const onIndexed = (event) => {
      const detail = event && event.detail ? event.detail : {};
      if (window.ElvishPerf && detail && detail.duration_ms != null) {
        window.ElvishPerf.record("mail_ui", "search_index", detail.duration_ms, "success");
      }
    };
    const onIndexErr = (event) => {
      const detail = event && event.detail ? event.detail : {};
      if (window.ElvishPerf && detail && detail.where === "index") {
        window.ElvishPerf.record("mail_ui", "search_index", 0, "failure");
      }
    };
    window.addEventListener("elvish-search-indexed", onIndexed);
    window.addEventListener("elvish-search-error", onIndexErr);
    return () => {
      window.removeEventListener("elvish-search-indexed", onIndexed);
      window.removeEventListener("elvish-search-error", onIndexErr);
    };
  }, []);

  // Load /api/auth/me to determine login state.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (cancelled) return;
        if (j && j.user) setMe(j.user);
        else setMe(false);
      })
      .catch(() => { if (!cancelled) setMe(false); });
    return () => { cancelled = true; };
  }, []);

  const loadIdentities = useCallback(async () => {
    if (!me || !guard.unlocked) return;
    try {
      const j = await window.ElvishMailManifest.listIdentities();
      setIdentities(j.identities || []);
    } catch (e) {
      console.warn("listIdentities", e);
    }
  }, [me, guard.unlocked]);

  // Load identities once unlocked (so we know fingerprints for header decrypt).
  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    let cancelled = false;
    async function initMailCache() {
      if (!me || !guard.unlocked || !window.ElvishMailCache || !window.ElvishKeyVault || !window.ElvishKeyVault.deriveAccountMailCacheSeed) {
        setMailCacheReady(false);
        return;
      }
      try {
        const mailCacheSeed = await window.ElvishKeyVault.deriveAccountMailCacheSeed();
        await window.ElvishMailCache.start({
          accountFingerprint: window.ElvishKeyVault.fingerprint ? window.ElvishKeyVault.fingerprint() : "",
          mailCacheSeed,
        });
        if (!cancelled) setMailCacheReady(true);
      } catch (e) {
        if (!cancelled) {
          console.warn("initMailCache", e);
          setMailCacheReady(false);
        }
      }
    }
    initMailCache();
    return () => { cancelled = true; };
  }, [me, guard.unlocked]);

  const loadFolderCounts = useCallback(async () => {
    if (!me || !guard.unlocked || !window.ElvishMailManifest || !window.ElvishMailManifest.listMailboxFolders) return;
    try {
      const payload = await window.ElvishMailManifest.listMailboxFolders();
      const rows = Array.isArray(payload && payload.folders) ? payload.folders : [];
      const next = {};
      for (const row of rows) {
        if (!row || !row.name) continue;
        next[String(row.name).toLowerCase()] = Number(row.total || 0);
      }
      setFolderCounts(next);
    } catch (_) {
      // Folder counts are optional enrichment; leave badges empty if the backend
      // does not expose this endpoint yet.
      setFolderCounts({});
    }
  }, [me, guard.unlocked]);

  useEffect(() => {
    loadFolderCounts();
  }, [loadFolderCounts]);

  useEffect(() => {
    if (!me || !guard.unlocked || retentionSetupHydratedRef.current || !window.ElvishMailManifest) return;
    let cancelled = false;
    async function loadRetentionSetup() {
      try {
        const [payload, deletePolicy] = await Promise.all([
          window.ElvishMailManifest.getMailSettings(),
          window.ElvishMailManifest.getDeletePolicy(),
        ]);
        if (cancelled) return;
        const settings = payload && payload.settings ? payload.settings : {};
        const retention = payload && payload.retention_days ? payload.retention_days : {};
        const policy = deletePolicy && deletePolicy.policy ? deletePolicy.policy : {};
        const inboxDays = typeof retention.inbox === "number" && retention.inbox > 0 ? retention.inbox : 30;
        setRetentionSetupInboxEnabled(typeof retention.inbox === "number" && retention.inbox > 0);
        setRetentionSetupInboxDays(inboxDays);
        setRetentionSetupAccountDeleteEnabled(!!policy.enabled);
        setRetentionSetupAccountDeleteValue(policy && typeof policy.value === "number" && policy.value > 0 ? policy.value : 30);
        setRetentionSetupAccountDeleteUnit(policy && policy.unit ? policy.unit : "days");
        setRetentionSetupOpen(!settings.retention_setup_completed);
        retentionSetupHydratedRef.current = true;
      } catch (e) {
        console.warn("mail settings", e);
      }
    }
    loadRetentionSetup();
    return () => { cancelled = true; };
  }, [me, guard.unlocked]);

  useEffect(() => {
    let cancelled = false;
    async function initSearch() {
      if (!me || !guard.unlocked || !Array.isArray(identities) || identities.length === 0) {
        setSearchReady(false);
        return;
      }
      if (!window.ElvishLocalSearch || !window.ElvishKeyVault || !window.ElvishKeyVault.deriveIdentitySearchSeed) {
        setSearchReady(false);
        return;
      }
      const defaultIdentity = (identities.find((i) => i.is_default) || identities[0] || {});
      const fp = defaultIdentity.fingerprint || "";
      if (!fp) {
        setSearchReady(false);
        return;
      }
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      try {
        const ident = window.ElvishKeyVault.getIdentity(fp);
        if (!ident || !ident.armoredPriv) {
          setSearchReady(false);
          return;
        }
        const identitySearchSeed = await window.ElvishKeyVault.deriveIdentitySearchSeed(fp);
        const engine = searchRef.current || new window.ElvishLocalSearch();
        await engine.start({
          identityFingerprint: fp,
          identitySearchSeed,
          identityArmoredPrivate: ident.armoredPriv,
          openpgpScriptUrl: "/vendor/openpgp-6.3.0.min.js",
        });
        if (cancelled) return;
        searchRef.current = engine;
        indexedMessagesRef.current = new Set();
        setSearchReady(true);
        if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "search_init", perfStartedAt, "success");
      } catch (e) {
        if (!cancelled) {
          console.warn("initSearch", e);
          setSearchReady(false);
          if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "search_init", perfStartedAt, "failure");
        }
      }
    }
    initSearch();
    return () => { cancelled = true; };
  }, [me, guard.unlocked, identities]);

  useEffect(() => {
    if (!searchReady || !searchRef.current) return;
    for (const m of messages) {
      if (!m || !m.id || indexedMessagesRef.current.has(m.id)) continue;
      indexedMessagesRef.current.add(m.id);
      const blobURL = new URL(`/api/v1/mail/messages/${encodeURIComponent(m.id)}/blob`, window.location.origin).toString();
      searchRef.current.indexMessage(m.id, blobURL);
    }
  }, [messages, searchReady]);

  const localHeaderFallback = useCallback(async (query, limit) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) =>
        ((m.subject || "").toLowerCase().includes(q)) ||
        ((m.from_addr || "").toLowerCase().includes(q)) ||
        ((m.preview || "").toLowerCase().includes(q))
      )
      .slice(0, limit)
      .map((m) => ({
        message_id: m.id,
        score: 0.5,
        snippet: m.preview || "",
        source: "local-metadata",
      }));
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      const q = search.trim();
      if (!q) {
        setSearchHits(null);
        return;
      }
      // Use null (not []) so visibleMessages keeps showing the folder list while the
      // search worker is still starting; [] means "query finished with zero hits".
      if (!searchReady || !searchRef.current) {
        setSearchHits(null);
        return;
      }
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      try {
        const hits = await searchRef.current.searchAll(q, {
          limit: 50,
          headersFallback: localHeaderFallback,
        });
        if (!cancelled) setSearchHits(hits);
        if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "search_query", perfStartedAt, "success");
      } catch (e) {
        if (!cancelled) {
          console.warn("runSearch", e);
          setSearchHits(null);
          if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "search_query", perfStartedAt, "failure");
        }
      }
    }
    runSearch();
    return () => { cancelled = true; };
  }, [search, searchReady, localHeaderFallback]);

  useEffect(() => {
    if (!me || !guard.unlocked) {
      setSenderProfiles(EMPTY_SENDER_PROFILES);
    }
  }, [me, guard.unlocked]);

  // Load folder messages and decrypt each header on the fly.
  const loadFolder = useCallback(async (target) => {
    if (!me) return;
    const loadGen = (folderLoadGenRef.current += 1);
    const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    setLoading(true);
    setSenderProfiles(EMPTY_SENDER_PROFILES);
    try {
      const j = await window.ElvishMailManifest.fetchManifests(target);
      const list = Array.isArray(j.messages) ? j.messages : [];
      const cache = mailCacheReady && window.ElvishMailCache ? window.ElvishMailCache : null;
      const cachedHeaders = cache && typeof cache.getHeaders === "function"
        ? await cache.getHeaders(list.map((m) => m && m.id).filter(Boolean))
        : {};
      // Try to decrypt each manifest header against the unlocked vault.
      const enriched = await Promise.all(list.map(async (m) => {
        let nextMessage = m;
        if (cache && typeof cache.unwrapVersionedPayload === "function" && typeof cache.extractVersion === "function") {
          const cached = cache.unwrapVersionedPayload(cachedHeaders[m.id], cache.extractVersion(m));
          if (cached) nextMessage = mergeRecoveredMessageData(nextMessage, cached);
        }
        const fpDefault = (identities.find((i) => i.is_default) || identities[0] || {}).fingerprint;
        if (!m.header_ciphertext_b64 || !window.ElvishKeyVault || !window.ElvishKeyVault.isUnlocked()) {
          return nextMessage;
        }
        try {
          const cipher = window.ElvishMailManifest.base64ToBytes(m.header_ciphertext_b64);
          // Iterate identities; rfc says PGP MESSAGE is addressable to multiple keys but
          // header was encrypted to ONE specific identity.
          let dec = null;
          const candidates = [fpDefault, ...(identities.map((i) => i.fingerprint).filter((f) => f && f !== fpDefault))].filter(Boolean);
          for (const fp of candidates) {
            try { dec = await window.ElvishKeyVault.decryptForIdentity(fp, cipher); break; }
            catch (_) { /* try next */ }
          }
          if (!dec) return nextMessage;
          const hdr = JSON.parse(dec);
          const hdrSubject = normalizeRecoveredSubject(hdr.subject);
          const hdrFrom = normalizeRecoveredAddress(hdr.from);
          const hdrTo = Array.isArray(hdr.to) ? hdr.to.map(normalizeRecoveredAddress).filter(Boolean) : [];
          const hdrCc = Array.isArray(hdr.cc) ? hdr.cc.map(normalizeRecoveredAddress).filter(Boolean) : [];
          nextMessage = { ...nextMessage,
            subject: hdrSubject || nextMessage.subject,
            from_addr: hdrFrom || nextMessage.from_addr,
            to_addrs: hdrTo.length > 0 ? hdrTo : nextMessage.to_addrs,
            cc_addrs: hdrCc.length > 0 ? hdrCc : (nextMessage.cc_addrs || []),
            rfc_message_id: (hdr.rfc_message_id && String(hdr.rfc_message_id).trim()) || nextMessage.rfc_message_id || "",
            in_reply_to: (hdr.in_reply_to && String(hdr.in_reply_to).trim()) || nextMessage.in_reply_to || "",
            references: (hdr.references && String(hdr.references).trim()) || nextMessage.references || "",
            reply_to: (hdr.reply_to && String(hdr.reply_to).trim()) || nextMessage.reply_to || "",
            attachments: Array.isArray(hdr.attachments) ? hdr.attachments : nextMessage.attachments,
            has_attachments: nextMessage.has_attachments || (Array.isArray(hdr.attachments) && hdr.attachments.length > 0),
            preview: hdr.preview || nextMessage.preview || "",
            headerDecrypted: true,
          };
          if (cache && typeof cache.putHeader === "function" && typeof cache.extractVersion === "function") {
            await cache.putHeader(m.id, cache.extractVersion(m), buildRecoveredHeaderPayload(nextMessage));
          }
          return nextMessage;
        } catch (_) { return nextMessage; }
      }));
      if (loadGen !== folderLoadGenRef.current) return;
      setMessages(enriched);
      setHasMail(true);
      if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "folder_load", perfStartedAt, "success");
    } catch (e) {
      if (loadGen !== folderLoadGenRef.current) return;
      const msg = (e && e.message) || String(e);
      if (msg.includes("503") || msg.includes("Service") || msg.includes("mail storage")) {
        setHasMail(false);
      }
      console.warn("loadFolder", msg);
      setMessages([]);
      if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "folder_load", perfStartedAt, "failure");
    } finally {
      if (loadGen === folderLoadGenRef.current) setLoading(false);
    }
  }, [me, identities, mailCacheReady]);

  const recoverMessageMetadata = useCallback((message, recovered, options = {}) => {
    if (!message || !message.id) return;
    if (recovered) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? mergeRecoveredMessageData(m, recovered) : m)));
    }
    void persistRecoveredArtifacts(message, recovered, options.envelope, options.decryptFingerprint).catch((e) => {
      console.warn("persistRecoveredArtifacts", e);
    });
  }, []);

  const runBackgroundMetadataRecovery = useCallback(async (message) => {
    const cache = mailCacheReady && window.ElvishMailCache ? window.ElvishMailCache : null;
    const version = cache && typeof cache.extractVersion === "function" ? cache.extractVersion(message) : "";
    try {
      if (cache && version && typeof cache.getEnvelope === "function" && typeof cache.unwrapVersionedPayload === "function") {
        const cachedEnvelopeEntry = await cache.getEnvelope(message.id);
        const cachedEnvelope = inflateCachedEnvelopePayload(cache.unwrapVersionedPayload(cachedEnvelopeEntry, version));
        if (cachedEnvelope && cachedEnvelope.recovered) {
          recoverMessageMetadata(message, cachedEnvelope.recovered, { envelope: cachedEnvelope, fromCache: true });
          return;
        }
      }
      const blob = await window.ElvishMailManifest.fetchBlob(message.id);
      const res = await decryptMessageBlobLocally(blob, identities);
      const envelope = extractDisplayEnvelope(res.data || "");
      const recovered = extractDecryptedMessageMetadata(res.data || "", envelope);
      if (recovered || envelope) recoverMessageMetadata(message, recovered, { envelope, decryptFingerprint: res.fingerprint });
    } catch (e) {
      console.warn("background metadata recovery", message && message.id, e);
    } finally {
      recoveryInFlightRef.current.delete(message.id);
    }
  }, [identities, mailCacheReady, recoverMessageMetadata]);

  useEffect(() => {
    if (!me || view !== "mail") return;
    if (!guard.unlocked) return;
    loadFolder(folder);
  }, [me, view, folder, guard.unlocked, mailCacheReady, loadFolder]);

  useEffect(() => {
    if (!me || !guard.unlocked || !mailCacheReady || !window.ElvishMailManifest) return;
    const availableSlots = Math.max(0, BACKGROUND_RECOVERY_CONCURRENCY - recoveryInFlightRef.current.size);
    if (availableSlots === 0) return;
    const candidates = messages.filter((message) => {
      if (!shouldRecoverMetadataFromBody(message)) return false;
      const version = window.ElvishMailCache && typeof window.ElvishMailCache.extractVersion === "function"
        ? window.ElvishMailCache.extractVersion(message)
        : "";
      if (!version) return false;
      if (recoveryInFlightRef.current.has(message.id)) return false;
      return recoveryAttemptVersionRef.current.get(message.id) !== version;
    }).slice(0, availableSlots);
    for (const message of candidates) {
      const version = window.ElvishMailCache.extractVersion(message);
      recoveryAttemptVersionRef.current.set(message.id, version);
      recoveryInFlightRef.current.add(message.id);
      void runBackgroundMetadataRecovery(message);
    }
  }, [messages, me, guard.unlocked, mailCacheReady, runBackgroundMetadataRecovery]);

  // Client-side filter rules: evaluate on decrypted inbox metadata; actions via PATCH/DELETE.
  useEffect(() => {
    if (!me || view !== "mail" || folder !== "inbox" || !guard.unlocked) return;
    if (!window.ElvishMailFilterEngine || !window.ElvishMailManifest || typeof window.ElvishMailManifest.listFilters !== "function") {
      return;
    }
    const gen = (filterRunGenRef.current += 1);
    if (filterRunTimerRef.current) clearTimeout(filterRunTimerRef.current);
    filterRunTimerRef.current = setTimeout(() => {
      void (async () => {
        let rawRules;
        try {
          const r = await window.ElvishMailManifest.listFilters();
          rawRules = Array.isArray(r.filters) ? r.filters : [];
        } catch {
          return;
        }
        if (gen !== filterRunGenRef.current) return;
        const decryptedMessages = messages.filter((m) => m && m.headerDecrypted);
        if (decryptedMessages.length === 0) return;
        const bodyByMessageId = {};
        for (const m of decryptedMessages) {
          if (m && m.id && typeof m.preview === "string" && m.preview.trim()) {
            bodyByMessageId[m.id] = m.preview;
          }
        }
        try {
          await window.ElvishMailFilterEngine.runInboxFilterPass(decryptedMessages, rawRules, {
            bodyByMessageId,
            onReload: () => {
              void loadFolder("inbox");
            },
          });
        } catch {
          /* ignore */
        }
      })();
    }, 450);
    return () => {
      if (filterRunTimerRef.current) clearTimeout(filterRunTimerRef.current);
    };
  }, [me, view, folder, guard.unlocked, messages, loadFolder]);

  const senderProfileIDs = useMemo(() => {
    const ids = new Set();
    for (const message of messages) {
      const senderId = canonicalizeSenderId(message && message.from_addr);
      if (senderId) ids.add(senderId);
    }
    return Array.from(ids);
  }, [messages]);

  useEffect(() => {
    if (!me || !guard.unlocked || !window.ElvishMailManifest || !window.ElvishMailManifest.lookupVisibleIdentityProfile) return;
    const missingSenderIDs = senderProfileIDs.filter((senderId) => !(senderId in senderProfiles));
    if (missingSenderIDs.length === 0) return;
    let cancelled = false;
    async function fillSenderProfiles() {
      try {
        const badgeEntries = await Promise.all(missingSenderIDs.map(async (senderId) => {
          try {
            const profile = await window.ElvishMailManifest.lookupVisibleIdentityProfile(senderId);
            return [senderId, profile && profile.visible ? profile : { visible: false }];
          } catch (_) {
            return [senderId, { visible: false }];
          }
        }));
        if (cancelled) return;
        setSenderProfiles((prev) => {
          const next = { ...prev };
          for (const [senderId, profile] of badgeEntries) {
            if (!(senderId in next)) next[senderId] = profile;
          }
          return next;
        });
      } catch (e) {
        if (!cancelled) console.warn("fillSenderProfiles", e);
      }
    }
    fillSenderProfiles();
    return () => { cancelled = true; };
  }, [me, guard.unlocked, senderProfileIDs, senderProfiles]);

  const visibleMessages = useMemo(() => {
    if (!search.trim() || !Array.isArray(searchHits)) return messages;
    const byID = new Map(messages.map((m) => [m.id, m]));
    return searchHits
      .map((hit) => {
        const id = hit.message_id || hit.id;
        if (!id || !byID.has(id)) return null;
        const msg = byID.get(id);
        return {
          ...msg,
          preview: hit.snippet || msg.preview || "",
          search_sources: Array.isArray(hit.sources) ? hit.sources : hit.source ? [hit.source] : [],
        };
      })
      .filter(Boolean);
  }, [messages, search, searchHits]);

  useEffect(() => {
    const vis = new Set(visibleMessages.map((m) => m.id));
    setListSelection((prev) => {
      if (prev.ids.length === 0 && !prev.focusId && !prev.anchorId) return prev;
      const ids = prev.ids.filter((id) => vis.has(id));
      const focusOk = !prev.focusId || vis.has(prev.focusId);
      const sameIds = ids.length === prev.ids.length && ids.every((id, i) => id === prev.ids[i]);
      if (sameIds && focusOk) {
        const anchorOk = !prev.anchorId || (vis.has(prev.anchorId) && ids.includes(prev.anchorId));
        if (anchorOk) return prev;
      }
      const focusId = focusOk ? prev.focusId : (ids[ids.length - 1] || null);
      let anchorId = prev.anchorId;
      if (!anchorId || !vis.has(anchorId) || !ids.includes(anchorId)) anchorId = ids[0] || null;
      return { ids, anchorId, focusId };
    });
  }, [visibleMessages]);

  const selectedMessage = useMemo(
    () => visibleMessages.find((m) => m.id === listSelection.focusId) || messages.find((m) => m.id === listSelection.focusId) || null,
    [visibleMessages, messages, listSelection.focusId],
  );
  const contextMessage = useMemo(() => {
    if (!contextMenu) return null;
    return visibleMessages.find((m) => m.id === contextMenu.messageId) || messages.find((m) => m.id === contextMenu.messageId) || null;
  }, [contextMenu, visibleMessages, messages]);

  const openNewCompose = useCallback(() => {
    setComposeDraft(null);
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposeDraft(null);
  }, []);

  const handleComposeReply = useCallback(({ message: m, replyAll, plainBody }) => {
    if (!m) return;
    const acct = me && typeof me === "object" && me.email ? me.email : "";
    const d = buildReplyComposeDraft(m, identities, acct, replyAll);
    d.bodyHtml = formatQuotedReplyBodyHtml(plainBody || "");
    setComposeDraft(d);
    setComposeOpen(true);
  }, [identities, me]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    setContextMenu(null);
  }, [folder, view]);

  useEffect(() => {
    if (!selectedMessage || selectedMessage.read) return;
    if (readInFlightRef.current.has(selectedMessage.id)) return;
    readInFlightRef.current.add(selectedMessage.id);
    setMessages((prev) => prev.map((m) => (m.id === selectedMessage.id ? { ...m, read: true } : m)));
    window.ElvishMailManifest.setMessageRead(selectedMessage.id, true)
      .catch((e) => {
        setMessages((prev) => prev.map((m) => (m.id === selectedMessage.id ? { ...m, read: false } : m)));
        setToast({ message: (e && e.message) || "Could not mark email as read", type: "err" });
      })
      .finally(() => {
        readInFlightRef.current.delete(selectedMessage.id);
      });
  }, [selectedMessage]);

  const handleMailListRowClick = useCallback((id, e) => {
    setContextMenu(null);
    const mod = e.metaKey || e.ctrlKey;
    const shift = e.shiftKey;
    const list = visibleMessages;
    setListSelection((prev) => {
      if (shift && prev.anchorId) {
        const a = list.findIndex((m) => m.id === prev.anchorId);
        const b = list.findIndex((m) => m.id === id);
        if (a < 0 || b < 0) return { ids: [id], anchorId: id, focusId: id };
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const ids = list.slice(lo, hi + 1).map((m) => m.id);
        return { ...prev, ids, focusId: id };
      }
      if (mod) {
        const set = new Set(prev.ids);
        const wasOn = set.has(id);
        if (wasOn) set.delete(id); else set.add(id);
        const ids = orderSelectedIdsByMessages(set, list);
        if (ids.length === 0) return emptyMailListSelection();
        const focusId = !wasOn ? id : (ids[ids.length - 1] || null);
        let anchorId = prev.anchorId;
        if (!anchorId || !ids.includes(anchorId)) anchorId = ids[0];
        return { ids, anchorId, focusId };
      }
      return { ids: [id], anchorId: id, focusId: id };
    });
  }, [visibleMessages]);

  const handleMailListCheckboxClick = useCallback((id) => {
    setContextMenu(null);
    const list = visibleMessages;
    setListSelection((prev) => {
      const set = new Set(prev.ids);
      const wasOn = set.has(id);
      if (wasOn) set.delete(id); else set.add(id);
      const ids = orderSelectedIdsByMessages(set, list);
      if (ids.length === 0) return emptyMailListSelection();
      const focusId = !wasOn ? id : (ids[ids.length - 1] || null);
      let anchorId = prev.anchorId;
      if (!anchorId || !ids.includes(anchorId)) anchorId = ids[0];
      return { ids, anchorId, focusId };
    });
  }, [visibleMessages]);

  const selectAllVisibleMail = useCallback(() => {
    setContextMenu(null);
    const list = visibleMessages;
    if (list.length === 0) return;
    const ids = list.map((m) => m.id);
    setListSelection({ ids, anchorId: ids[0], focusId: ids[ids.length - 1] });
  }, [visibleMessages]);

  const clearMailListSelection = useCallback(() => {
    setContextMenu(null);
    setListSelection(emptyMailListSelection());
  }, []);

  const openMessageContextMenu = useCallback((event, message) => {
    event.preventDefault();
    if (!message || !message.id) return;
    const menuWidth = 220;
    const menuHeight = 220;
    const x = Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12));
    const y = Math.max(12, Math.min(event.clientY, window.innerHeight - menuHeight - 12));
    setContextMenu({ x, y, messageId: message.id });
  }, []);

  useEffect(() => {
    if (view !== "mail" || !hasMail) return;
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (contextMenu) return;
      if (e.altKey) return;
      if (e.metaKey || e.ctrlKey) return;
      const list = visibleMessages;
      if (e.key === "Escape") {
        const sel = listSelectionRef.current;
        if (sel.ids.length > 1 && sel.focusId) {
          e.preventDefault();
          const f = sel.focusId;
          setListSelection({ ids: [f], anchorId: f, focusId: f });
          return;
        }
      }
      if ((e.key === "c" || e.key === "C") && view === "mail") {
        e.preventDefault();
        setComposeDraft(null);
        setComposeOpen(true);
        return;
      }
      if ((e.key === "r" || e.key === "R") && view === "mail") {
        e.preventDefault();
        loadFolder(folder);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (list.length === 0) return;
        e.preventDefault();
        const sel = listSelectionRef.current;
        const shift = e.shiftKey;
        if (shift && sel.anchorId) {
          const anchorIdx = list.findIndex((m) => m.id === sel.anchorId);
          const focusIdx = list.findIndex((m) => m.id === sel.focusId);
          const curIdx = focusIdx >= 0 ? focusIdx : anchorIdx;
          let nextIdx;
          if (e.key === "ArrowDown") nextIdx = curIdx < 0 ? 0 : Math.min(list.length - 1, curIdx + 1);
          else nextIdx = curIdx < 0 ? list.length - 1 : Math.max(0, curIdx - 1);
          if (anchorIdx < 0) {
            const next = list[nextIdx];
            if (!next) return;
            setListSelection({ ids: [next.id], anchorId: next.id, focusId: next.id });
          } else {
            const lo = Math.min(anchorIdx, nextIdx);
            const hi = Math.max(anchorIdx, nextIdx);
            const ids = list.slice(lo, hi + 1).map((m) => m.id);
            const next = list[nextIdx];
            if (!next) return;
            setListSelection({ ids, anchorId: sel.anchorId, focusId: next.id });
          }
          const scrolledId = list[nextIdx].id;
          requestAnimationFrame(() => {
            document.getElementById(`mail-item-${scrolledId}`)?.scrollIntoView({ block: "nearest" });
          });
          return;
        }
        const idx = sel.focusId ? list.findIndex((m) => m.id === sel.focusId) : -1;
        let nextIdx;
        if (e.key === "ArrowDown") nextIdx = idx < 0 ? 0 : Math.min(list.length - 1, idx + 1);
        else nextIdx = idx < 0 ? list.length - 1 : Math.max(0, idx - 1);
        const next = list[nextIdx];
        if (!next) return;
        setListSelection({ ids: [next.id], anchorId: next.id, focusId: next.id });
        requestAnimationFrame(() => {
          document.getElementById(`mail-item-${next.id}`)?.scrollIntoView({ block: "nearest" });
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, hasMail, visibleMessages, folder, loadFolder, contextMenu]);

  const executeDeleteMessage = useCallback(async (messageId, { permanent = false } = {}) => {
    setConfirmLoading(true);
    try {
      const result = await window.ElvishMailManifest.deleteMessage(messageId, { permanent });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setListSelection((prev) => mailListSelectionAfterRemoving(prev, new Set([messageId])));
      setToast({
        message: result && result.deleted ? "Email permanently deleted" : "Email moved to trash",
        type: "ok",
      });
      loadFolderCounts();
      setConfirmModal(null);
    } catch (e) {
      setToast({ message: (e && e.message) || "Delete failed", type: "err" });
    } finally {
      setConfirmLoading(false);
    }
  }, [loadFolderCounts]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!messageId) return;
    setContextMenu(null);
    if (folder === "trash") {
      setConfirmModal({
        title: "Delete Permanently",
        message: "This will permanently delete the email. This action cannot be undone.",
        confirmLabel: "Delete Forever",
        onConfirm: () => executeDeleteMessage(messageId, { permanent: true }),
      });
    } else {
      try {
        const result = await window.ElvishMailManifest.deleteMessage(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setListSelection((prev) => mailListSelectionAfterRemoving(prev, new Set([messageId])));
        setToast({
          message: result && result.deleted ? "Email permanently deleted" : "Email moved to trash",
          type: "ok",
        });
        loadFolderCounts();
      } catch (e) {
        setToast({ message: (e && e.message) || "Delete failed", type: "err" });
      }
    }
  }, [folder, executeDeleteMessage]);

  const handleDeleteImmediately = useCallback((messageId) => {
    if (!messageId) return;
    setContextMenu(null);
    setConfirmModal({
      title: "Delete Immediately",
      message: "This will permanently delete the email without waiting for the trash retention window.",
      confirmLabel: "Delete Now",
      onConfirm: () => executeDeleteMessage(messageId, { permanent: true }),
    });
  }, [executeDeleteMessage]);

  const openEmptyTrashConfirm = useCallback(() => {
    if (!window.ElvishMailManifest) return;
    setContextMenu(null);
    setConfirmModal({
      title: "Empty Trash",
      message: "Permanently delete all messages in Trash? This cannot be undone.",
      confirmLabel: "Delete All",
      onConfirm: async () => {
        setConfirmLoading(true);
        let deleted = 0;
        try {
          const batchLimit = 100;
          for (;;) {
            const j = await window.ElvishMailManifest.fetchManifests("trash", { limit: batchLimit });
            const list = Array.isArray(j.messages) ? j.messages : [];
            if (list.length === 0) break;
            for (const row of list) {
              if (!row || !row.id) continue;
              await window.ElvishMailManifest.deleteMessage(row.id, { permanent: true });
              deleted += 1;
            }
          }
          setMessages([]);
          setListSelection(emptyMailListSelection());
          setToast({
            message: deleted ? `Permanently deleted ${deleted} message${deleted === 1 ? "" : "s"}` : "Trash is already empty",
            type: "ok",
          });
          await loadFolder("trash");
          loadFolderCounts();
          setConfirmModal(null);
        } catch (e) {
          setToast({ message: (e && e.message) || "Could not empty trash", type: "err" });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  }, [loadFolder, loadFolderCounts]);

  const handleMoveMessage = useCallback(async (messageId, targetFolder) => {
    if (!messageId || !targetFolder) return;
    setContextMenu(null);
    try {
      const result = await window.ElvishMailManifest.moveMessage(messageId, targetFolder);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setListSelection((prev) => mailListSelectionAfterRemoving(prev, new Set([messageId])));
      const nextFolder = (result && result.folder) || targetFolder;
      setToast({ message: `Email moved to ${nextFolder}`, type: "ok" });
      loadFolderCounts();
    } catch (e) {
      setToast({ message: (e && e.message) || "Move failed", type: "err" });
    }
  }, [loadFolderCounts]);

  const bulkMoveSelected = useCallback(async (targetFolder) => {
    const ids = [...listSelection.ids];
    if (!ids.length || !targetFolder) return;
    setBulkBusy(true);
    setContextMenu(null);
    try {
      const removed = new Set();
      for (const messageId of ids) {
        await window.ElvishMailManifest.moveMessage(messageId, targetFolder);
        removed.add(messageId);
      }
      setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
      setListSelection((prev) => mailListSelectionAfterRemoving(prev, removed));
      setToast({
        message: `Moved ${removed.size} message${removed.size === 1 ? "" : "s"} to ${targetFolder}`,
        type: "ok",
      });
      loadFolderCounts();
    } catch (e) {
      setToast({ message: (e && e.message) || "Move failed", type: "err" });
    } finally {
      setBulkBusy(false);
    }
  }, [listSelection.ids, loadFolderCounts]);

  const bulkArchiveSelected = useCallback(() => bulkMoveSelected("archive"), [bulkMoveSelected]);

  const bulkRestoreInboxSelected = useCallback(() => bulkMoveSelected("inbox"), [bulkMoveSelected]);

  const bulkTrashSelected = useCallback(async () => {
    const ids = [...listSelection.ids];
    if (!ids.length || folder === "trash") return;
    setBulkBusy(true);
    setContextMenu(null);
    try {
      const removed = new Set();
      for (const messageId of ids) {
        await window.ElvishMailManifest.deleteMessage(messageId);
        removed.add(messageId);
      }
      setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
      setListSelection((prev) => mailListSelectionAfterRemoving(prev, removed));
      setToast({
        message: `Moved ${removed.size} message${removed.size === 1 ? "" : "s"} to trash`,
        type: "ok",
      });
      loadFolderCounts();
    } catch (e) {
      setToast({ message: (e && e.message) || "Move to trash failed", type: "err" });
    } finally {
      setBulkBusy(false);
    }
  }, [listSelection.ids, folder, loadFolderCounts]);

  const bulkPermDeleteSelected = useCallback(() => {
    const ids = listSelection.ids;
    if (!ids.length) return;
    setContextMenu(null);
    setConfirmModal({
      title: "Delete Permanently",
      message: `Permanently delete ${ids.length} message${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      confirmLabel: "Delete Forever",
      onConfirm: async () => {
        setConfirmLoading(true);
        const removed = new Set();
        try {
          for (const messageId of ids) {
            await window.ElvishMailManifest.deleteMessage(messageId, { permanent: true });
            removed.add(messageId);
          }
          setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
          setListSelection((prev) => mailListSelectionAfterRemoving(prev, removed));
          setToast({
            message: `Permanently deleted ${removed.size} message${removed.size === 1 ? "" : "s"}`,
            type: "ok",
          });
          loadFolderCounts();
          setConfirmModal(null);
        } catch (e) {
          setToast({ message: (e && e.message) || "Delete failed", type: "err" });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  }, [listSelection.ids, loadFolderCounts]);

  const bulkMarkReadSelected = useCallback(async () => {
    const targets = listSelection.ids.filter((id) => {
      const m = messages.find((x) => x.id === id);
      return m && !m.read;
    });
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of targets) {
        await window.ElvishMailManifest.setMessageRead(id, true);
      }
      setMessages((prev) => prev.map((m) => (targets.includes(m.id) ? { ...m, read: true } : m)));
      setToast({
        message: `Marked ${targets.length} message${targets.length === 1 ? "" : "s"} as read`,
        type: "ok",
      });
    } catch (e) {
      setToast({ message: (e && e.message) || "Could not mark as read", type: "err" });
    } finally {
      setBulkBusy(false);
    }
  }, [listSelection.ids, messages]);

  const contextMenuActions = useMemo(() => {
    if (!contextMessage) return [];
    const actions = [];
    if (folder === "trash") {
      actions.push({ id: "restore", label: "Move To Inbox", icon: Icons.inbox, onClick: (messageId) => handleMoveMessage(messageId, "inbox") });
      actions.push({ id: "delete-permanent", label: "Delete Permanently", icon: Icons.trash, variant: "danger", onClick: handleDeleteMessage });
      return actions;
    }
    if (folder !== "archive") {
      actions.push({ id: "archive", label: "Archive", icon: Icons.archive, onClick: (messageId) => handleMoveMessage(messageId, "archive") });
    } else {
      actions.push({ id: "restore", label: "Move To Inbox", icon: Icons.inbox, onClick: (messageId) => handleMoveMessage(messageId, "inbox") });
    }
    actions.push({ id: "trash", label: "Move To Trash", icon: Icons.trash, onClick: handleDeleteMessage });
    actions.push({ id: "delete-now", label: "Delete Immediately", icon: Icons.trash, variant: "danger", onClick: handleDeleteImmediately });
    return actions;
  }, [contextMessage, folder, handleDeleteImmediately, handleDeleteMessage, handleMoveMessage]);

  const copyDisposable = useCallback(async (email) => {
    if (!email) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(email);
        setToast({ message: "Disposable copied to clipboard", type: "ok" });
        return;
      }
    } catch (_) {
      // Fall back to leaving the address visible in the sidebar.
    }
    setToast({ message: "Disposable ready in sidebar", type: "ok" });
  }, []);

  const createDisposable = useCallback(async () => {
    if (!me || creatingDisposable) return;
    setCreatingDisposable(true);
    try {
      const created = await window.ElvishMailManifest.createGeneratedIdentity({
        accountEmail: me.email,
        type: "disposable",
      });
      const email = created && created.email ? created.email : "";
      setLatestDisposable(email);
      if (guard.unlocked) await loadIdentities();
      await copyDisposable(email);
    } catch (e) {
      setToast({ message: (e && e.message) || "Disposable create failed", type: "err" });
    } finally {
      setCreatingDisposable(false);
    }
  }, [me, creatingDisposable, guard.unlocked, loadIdentities, copyDisposable]);

  const saveRetentionSetup = useCallback(async ({ inboxEnabled, accountDeleteEnabled }) => {
    setRetentionSetupBusy(true);
    try {
      await window.ElvishMailManifest.setDeletePolicy({
        enabled: !!accountDeleteEnabled,
        value: accountDeleteEnabled ? Number(retentionSetupAccountDeleteValue) : 0,
        unit: accountDeleteEnabled ? retentionSetupAccountDeleteUnit : "",
      });
      await window.ElvishMailManifest.setMailSettings({
        retention_setup_completed: true,
        retention_days: {
          inbox: inboxEnabled ? retentionSetupInboxDays : null,
        },
      });
      setRetentionSetupOpen(false);
      setRetentionSetupInboxEnabled(!!inboxEnabled);
      setRetentionSetupAccountDeleteEnabled(!!accountDeleteEnabled);
    } catch (e) {
      setToast({ message: (e && e.message) || "Could not save setup", type: "err" });
    } finally {
      setRetentionSetupBusy(false);
    }
  }, [retentionSetupAccountDeleteUnit, retentionSetupAccountDeleteValue, retentionSetupInboxDays]);

  useEffect(() => {
    if (me && typeof me === "object" && view === "admin" && !me.is_admin) {
      setView("mail");
      setToast({ message: "Admin requires an operator session.", type: "err" });
    }
  }, [me, view]);

  useEffect(() => {
    if (view !== "settings") {
      return;
    }
    if (window.ElvishMailSettings) {
      setSettingsEmbedStatus("ready");
      return;
    }
    if (settingsEmbedScriptRef.current) {
      return;
    }
    settingsEmbedScriptRef.current = true;
    setSettingsEmbedStatus("loading");
    const s = document.createElement("script");
    s.src = "/dist/mail-settings-lazy.js";
    s.async = true;
    s.dataset.elvishMailSettingsLazy = "1";
    s.onload = () => {
      if (window.ElvishMailSettings) {
        setSettingsEmbedStatus("ready");
      } else {
        settingsEmbedScriptRef.current = false;
        s.remove();
        setSettingsEmbedStatus("error");
      }
    };
    s.onerror = () => {
      settingsEmbedScriptRef.current = false;
      s.remove();
      setSettingsEmbedStatus("error");
    };
    document.head.appendChild(s);
  }, [view]);

  useEffect(() => {
    if (view !== "admin" || !me || typeof me !== "object" || !me.is_admin) {
      return;
    }
    if (window.ElvishMailAdminPanel) {
      setAdminEmbedStatus("ready");
      setAdminEmbedFailReason(null);
      return;
    }
    if (adminEmbedScriptRef.current) {
      return;
    }
    adminEmbedScriptRef.current = true;
    setAdminEmbedStatus("loading");
    setAdminEmbedFailReason(null);

    const injectAdminPanelStyles = (onDone) => {
      if (window.__elvishMailAdminPanelStylesInjected) {
        onDone();
        return;
      }
      const hrefs = ["/admin/modals.css", "/admin/admin.css"];
      let pending = hrefs.length;
      const tick = () => {
        pending -= 1;
        if (pending <= 0) {
          window.__elvishMailAdminPanelStylesInjected = true;
          onDone();
        }
      };
      for (const href of hrefs) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.dataset.elvishMailAdminEmbed = "1";
        link.onload = tick;
        link.onerror = tick;
        document.head.appendChild(link);
      }
    };

    const failEmbed = () => {
      probeMailAdminEmbedFailReason().then((reason) => {
        setAdminEmbedFailReason(reason);
        setAdminEmbedStatus("error");
      });
    };

    const startScript = () => {
      const s = document.createElement("script");
      s.src = "/dist/mail-admin-embed.js";
      s.async = true;
      s.dataset.elvishMailAdminEmbed = "1";
      s.onload = () => {
        if (window.ElvishMailAdminPanel) {
          setAdminEmbedFailReason(null);
          setAdminEmbedStatus("ready");
        } else {
          adminEmbedScriptRef.current = false;
          s.remove();
          failEmbed();
        }
      };
      s.onerror = () => {
        adminEmbedScriptRef.current = false;
        s.remove();
        failEmbed();
      };
      document.head.appendChild(s);
    };

    injectAdminPanelStyles(startScript);
  }, [view, me]);

  // Auth gate.
  if (me === null) {
    return <FullScreenStatus message="loading…" />;
  }
  if (me === false) {
    return <LoggedOutPrompt />;
  }

  // Settings or embedded admin (same-origin session; APIs still enforce is_admin server-side).
  const showSettings = view === "settings";
  const showAdminIntent = view === "admin" && me && typeof me === "object" && me.is_admin;
  const showAdmin = showAdminIntent && adminEmbedStatus === "ready" && window.ElvishMailAdminPanel;

  return (
    <div className={`mail-shell no-topbar ${listSelection.focusId ? "detail-open" : ""}`}>
      <Sidebar
        folder={folder}
        setFolder={(f) => { setListSelection(emptyMailListSelection()); setFolder(f); }}
        onCompose={openNewCompose}
        onCreateDisposable={createDisposable}
        onCopyDisposable={copyDisposable}
        creatingDisposable={creatingDisposable}
        latestDisposable={latestDisposable}
        folderCounts={folderCounts}
        view={view}
        onViewChange={setView}
        user={me}
        vaultUnlocked={guard.unlocked}
        onVaultClick={() => { if (window.ElvishKeyVault && guard.unlocked) window.ElvishKeyVault.zero({ clearPersisted: true, clearTrustedDevice: false }); guard.openModal(); }}
        isAdmin={me.is_admin}
      />

      {showSettings && window.ElvishMailSettings ? (
        <main className="mail-settings-host">
          {React.createElement(window.ElvishMailSettings, { user: me })}
        </main>
      ) : showSettings ? (
        <main className="mail-settings-host mail-admin-embed-loading">
          {settingsEmbedStatus === "error" ? (
            <div style={{ padding: 24, maxWidth: 520 }}>
              <p className="mail-msg-body" style={{ marginBottom: 12 }}>Could not load settings.</p>
              <p className="mail-msg-body" style={{ marginBottom: 0 }}>
                Please reload the page. If the problem persists, confirm <code className="mono">mail-settings-lazy.js</code> was built (<code className="mono">node frontend/build.mjs</code>).
              </p>
              <button
                type="button"
                className="btn-sm"
                style={{ marginTop: 16 }}
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          ) : (
            <FullScreenStatus message="Loading settings…" />
          )}
        </main>
      ) : showAdminIntent && !showAdmin ? (
        <main className="mail-admin-host mail-admin-embed-loading">
          {adminEmbedStatus === "error" ? (
            <div style={{ padding: 24, maxWidth: 520 }}>
              <p className="mail-msg-body" style={{ marginBottom: 12 }}>Could not load the operator panel.</p>
              {adminEmbedFailReason === "forbidden" ? (
                <p className="mail-msg-body" style={{ marginBottom: 12 }}>
                  The server returned HTTP 403 for operator JavaScript. When asset gating is enabled, use an admin session in this browser (for example open <a href="/admin/">/admin/</a> once so cookies are set), then return here.
                </p>
              ) : null}
              <p className="mail-msg-body" style={{ marginBottom: 0 }}>
                Please reload the page and try again. If the problem persists, check the browser console for errors.
              </p>
              <button
                type="button"
                className="btn-sm"
                style={{ marginTop: 16 }}
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          ) : (
            <FullScreenStatus message="Loading operator panel…" />
          )}
        </main>
      ) : showAdmin && window.ElvishMailAdminPanel ? (
        <main className="mail-admin-host">
          {React.createElement(window.ElvishMailAdminPanel, {
            embedded: true,
            onLeaveEmbedded: () => setView("mail"),
          })}
        </main>
      ) : !hasMail ? (
        <main className="mail-unavailable">
          <span className="icon">⚠</span>
          <h2>Mail subsystem unavailable</h2>
          <p>The server returned 503. ScyllaDB or object storage is probably not configured. Check elvishserver logs.</p>
          <button className="btn-sm" onClick={() => loadFolder(folder)}>Retry</button>
        </main>
      ) : (
        <>
          <MessageList
            messages={visibleMessages}
            selectedIds={listSelection.ids}
            focusedId={listSelection.focusId}
            onRowClick={handleMailListRowClick}
            onCheckboxClick={handleMailListCheckboxClick}
            onSelectAllVisible={selectAllVisibleMail}
            onClearSelection={clearMailListSelection}
            onBulkArchive={bulkArchiveSelected}
            onBulkTrash={bulkTrashSelected}
            onBulkRestoreInbox={bulkRestoreInboxSelected}
            onBulkDeletePermanent={bulkPermDeleteSelected}
            onBulkMarkRead={bulkMarkReadSelected}
            bulkBusy={bulkBusy || confirmLoading}
            onMessageContextMenu={openMessageContextMenu}
            folder={folder}
            onRefresh={() => loadFolder(folder)}
            onEmptyTrash={folder === "trash" ? openEmptyTrashConfirm : undefined}
            emptyTrashDisabled={
              loading ||
              confirmLoading ||
              (!((folderCounts.trash || 0) > 0) && messages.length === 0)
            }
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            senderProfiles={senderProfiles}
            onCompose={openNewCompose}
            listRef={mailListRef}
          />
          <MessageDetail
            message={selectedMessage}
            identities={identities}
            unlocked={guard.unlocked}
            onMetadataRecovered={recoverMessageMetadata}
            onComposeReply={handleComposeReply}
          />
        </>
      )}

      {window.ElvishMailCompose && React.createElement(window.ElvishMailCompose, {
        open: composeOpen,
        onClose: closeCompose,
        initialDraft: composeDraft,
        identities,
        defaultFrom: (identities.find((i) => i.is_default) || identities[0] || {}).email || me.email,
        onToast: (t) => setToast(t),
      })}

      {window.ElvishMailUnlockModal && React.createElement(window.ElvishMailUnlockModal, {
        open: guard.modalOpen && !guard.unlocked && guard.vaultHydrated,
        onUnlocked: () => { guard.onUnlocked(); loadFolder(folder); },
        onClose: () => guard.closeModal(),
        idleLockout: guard.idleLockout,
      })}

      <RetentionSetupModal
        open={retentionSetupOpen && view === "mail"}
        loading={retentionSetupBusy}
        inboxEnabled={retentionSetupInboxEnabled}
        inboxDays={retentionSetupInboxDays}
        accountDeleteEnabled={retentionSetupAccountDeleteEnabled}
        accountDeleteValue={retentionSetupAccountDeleteValue}
        accountDeleteUnit={retentionSetupAccountDeleteUnit}
        onToggleInbox={setRetentionSetupInboxEnabled}
        onChangeDays={(value) => {
          const n = parseInt(value, 10);
          if (!Number.isFinite(n) || n < 1) return;
          setRetentionSetupInboxDays(n);
        }}
        onToggleAccountDelete={setRetentionSetupAccountDeleteEnabled}
        onChangeAccountDeleteValue={(value) => {
          const n = parseInt(value, 10);
          if (!Number.isFinite(n) || n < 1) return;
          setRetentionSetupAccountDeleteValue(n);
        }}
        onChangeAccountDeleteUnit={setRetentionSetupAccountDeleteUnit}
        onSkip={() => saveRetentionSetup({ inboxEnabled: false, accountDeleteEnabled: false })}
        onSave={() => saveRetentionSetup({
          inboxEnabled: retentionSetupInboxEnabled,
          accountDeleteEnabled: retentionSetupAccountDeleteEnabled,
        })}
      />

      <Toast message={toast && toast.message} type={toast && toast.type} onClose={() => setToast(null)} />
      <MessageContextMenu
        menu={contextMessage ? contextMenu : null}
        actions={contextMenuActions}
      />

      <ConfirmModal
        open={!!confirmModal}
        onClose={() => { if (!confirmLoading) setConfirmModal(null); }}
        onConfirm={confirmModal?.onConfirm}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        confirmVariant="danger"
        loading={confirmLoading}
      />

      <div className="mail-kbd-hints">
        <span className="mail-kbd-hint"><kbd>C</kbd> compose</span>
        <span className="mail-kbd-hint"><kbd>R</kbd> refresh</span>
        <span className="mail-kbd-hint"><kbd>↑</kbd><kbd>↓</kbd> list</span>
        <span className="mail-kbd-hint"><kbd>⇧</kbd><kbd>↑</kbd><kbd>↓</kbd> range</span>
        <span className="mail-kbd-hint"><kbd>Esc</kbd> one</span>
        <span className="mail-kbd-hint hint-long">⌘/Ctrl+click · shift+click · checkboxes</span>
      </div>
    </div>
  );
}

function FullScreenStatus({ message }) {
  return (
    <div className="mail-shell">
      <window.ElvishPublicTopbar
        activeNavId="mail"
        meOverride={null}
        showMailLink={false}
        authContent={<span className="dim">{message}</span>}
      />
      <div className="mail-loading" style={{ gridColumn: "1 / -1" }}>
        <div className="spinner"></div><span>{message}</span>
      </div>
    </div>
  );
}

function LoggedOutPrompt() {
  return (
    <div className="mail-shell">
      <window.ElvishPublicTopbar
        activeNavId="mail"
        loginHref="/login?next=%2Fmail"
        registerHref="/register?next=%2Fmail"
        rightBeforeUtc={<span className="dim">guest</span>}
      />
      <div className="mail-login-prompt">
        <div className="glyph">{Icons.mail}</div>
        <h2>Encrypted Mail</h2>
        <p>End-to-end encrypted email with OpenPGP. Your keys, your messages, zero-access architecture.</p>
        <div className="actions">
          <a href="/login?next=%2Fmail" className="btn-sm primary">▸ Login</a>
          <a href="/register?next=%2Fmail" className="btn-sm">Register</a>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) ReactDOM.createRoot(root).render(<MailApp />);
