// ELVISH — protected message recipient page (vanilla JS).
//
// Flow:
//   1. Read token from /m/{token}.
//   2. GET /api/v1/protected-links/{token}/meta → render expiry/views.
//   3. Recipient enters password → POST .../open → atomic ConsumeView →
//      returns { wrapped_msg_key_b64, ciphertext_b64, kdf, kdf_salt_b64, ... }
//   4. We KEK-derive(password, salt) → AES-GCM-unwrap msgKey →
//      AES-GCM-open ciphertext → render plaintext.
//
// The password is NEVER posted to the server; it stays in this tab.

(function () {
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const errEl = $("err");

  function setStatus(s) { status.textContent = s; }
  function setErr(s) { errEl.textContent = s || ""; }

  function readToken() {
    const path = window.location.pathname || "";
    const i = path.indexOf("/m/");
    if (i < 0) return "";
    return path.slice(i + 3).replace(/\/+$/, "");
  }

  function b64ToBytes(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function utf8(s) { return new TextEncoder().encode(s); }
  function bytesToUtf8(b) { return new TextDecoder().decode(b); }
  function formatBytes(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let idx = 0;
    let cur = n;
    while (cur >= 1024 && idx < units.length - 1) {
      cur /= 1024;
      idx += 1;
    }
    return `${cur >= 10 || idx === 0 ? cur.toFixed(0) : cur.toFixed(1)} ${units[idx]}`;
  }

  function parseHeaderBlock(headerBlock) {
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

  function htmlToDisplayText(html) {
    return String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function decodeMailBody(body, transferEncoding) {
    const encoding = String(transferEncoding || "").trim().toLowerCase();
    if (!encoding || encoding === "7bit" || encoding === "8bit" || encoding === "binary") return body;
    if (encoding === "quoted-printable") {
      return String(body || "").replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    if (encoding === "base64") return bytesToUtf8(b64ToBytes(String(body || "").replace(/\s+/g, "")));
    return body;
  }

  function decodeAttachmentBytes(body, transferEncoding) {
    const encoding = String(transferEncoding || "").trim().toLowerCase();
    if (encoding === "base64") return b64ToBytes(String(body || "").replace(/\s+/g, ""));
    const raw = String(body || "");
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 0xff;
    return out;
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

  function parseMimeEntity(headers, body, depth) {
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
          fileName: filename || "attachment.bin",
          contentType: kind || "application/octet-stream",
          bytes: decodeAttachmentBytes(normalizedBody, transferEncoding),
        }],
      };
    }

    if ((depth || 0) < 8 && kind.startsWith("multipart/")) {
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
                const innerHeaders = parseHeaderBlock(first.slice(0, partSep));
                if (innerHeaders) {
                  return parseMimeEntity(innerHeaders, first.slice(partSep + 2), (depth || 0) + 1);
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
          const partHeaders = parseHeaderBlock(part.slice(0, partSep));
          if (!partHeaders) continue;
          const child = parseMimeEntity(partHeaders, part.slice(partSep + 2), (depth || 0) + 1);
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

  function parseMimeEnvelope(text) {
    const normalized = String(text || "").replace(/\r\n/g, "\n");
    const separatorIndex = normalized.indexOf("\n\n");
    if (separatorIndex <= 0) return { bodyText: text || "", bodyHtml: "", attachments: [] };
    const headers = parseHeaderBlock(normalized.slice(0, separatorIndex));
    if (!headers) return { bodyText: text || "", bodyHtml: "", attachments: [] };
    const body = normalized.slice(separatorIndex + 2);
    const envelope = parseMimeEntity(headers, body, 0);
    const contentType = String(headers["content-type"] || "").toLowerCase();
    if (envelope.bodyScore > 0 || envelope.attachments.length > 0 || contentType.startsWith("multipart/")) {
      return {
        bodyText: envelope.bodyText || "",
        bodyHtml: envelope.bodyHtml || "",
        attachments: envelope.attachments,
      };
    }
    return {
      bodyText: decodeMailBody(body, headers["content-transfer-encoding"]),
      bodyHtml: "",
      attachments: [],
    };
  }

  function renderDecryptedBody(envelope) {
    const purify = window.DOMPurify;
    const htmlTrim = (envelope.bodyHtml && String(envelope.bodyHtml).trim()) || "";
    const host = $("decrypted-body-html-host");
    const pre = $("decrypted-body");
    if (purify && htmlTrim) {
      pre.hidden = true;
      pre.textContent = "";
      host.hidden = false;
      host.textContent = "";
      const iframe = document.createElement("iframe");
      iframe.className = "protected-decrypted-frame";
      iframe.title = "Sanitized HTML message";
      iframe.setAttribute("sandbox", "");
      iframe.referrerPolicy = "no-referrer";
      iframe.srcdoc = "<!DOCTYPE html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'\"><style>body{font-family:system-ui,Segoe UI,sans-serif;margin:12px;line-height:1.45;word-break:break-word;}</style>" + purify.sanitize(htmlTrim);
      host.appendChild(iframe);
    } else {
      host.hidden = true;
      host.textContent = "";
      pre.hidden = false;
      pre.textContent = envelope.bodyText || "";
    }
  }

  function renderAttachments(list) {
    const host = $("decrypted-attachments");
    host.innerHTML = "";
    if (!Array.isArray(list) || list.length === 0) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    for (const attachment of list) {
      const row = document.createElement("div");
      row.className = "protected-attachment";
      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "protected-attachment-name";
      name.textContent = attachment.fileName || "attachment.bin";
      const meta = document.createElement("div");
      meta.className = "protected-attachment-meta";
      meta.textContent = `${attachment.contentType || "application/octet-stream"} · ${formatBytes(attachment.bytes && attachment.bytes.length)}`;
      info.appendChild(name);
      info.appendChild(meta);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-sm primary protected-attachment-btn";
      btn.textContent = "Download";
      btn.addEventListener("click", () => {
        const blob = new Blob([attachment.bytes], { type: attachment.contentType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.fileName || "attachment.bin";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      row.appendChild(info);
      row.appendChild(btn);
      host.appendChild(row);
    }
  }

  async function deriveKEK(password, salt, kdfHint, params) {
    if (window.ElvishKeygen && typeof window.ElvishKeygen.deriveKEK === "function") {
      const derived = await window.ElvishKeygen.deriveKEK(password, salt, kdfHint, params || {});
      return derived.key;
    }
    throw new Error("crypto runtime not loaded");
  }

  async function aesUnwrap(kek, wrappedBytes) {
    if (wrappedBytes.length < 12) throw new Error("wrapped key too short");
    const nonce = wrappedBytes.slice(0, 12);
    const ct = wrappedBytes.slice(12);
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, kek, ct);
    return new Uint8Array(out);
  }

  async function aesOpen(msgKeyBytes, payloadBytes) {
    if (payloadBytes.length < 12) throw new Error("ciphertext too short");
    const key = await crypto.subtle.importKey("raw", msgKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const nonce = payloadBytes.slice(0, 12);
    const ct = payloadBytes.slice(12);
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct);
    return new Uint8Array(out);
  }

  async function loadMeta(token) {
    const resp = await fetch(`/api/v1/protected-links/${encodeURIComponent(token)}/meta`, { credentials: "omit" });
    if (resp.status === 404) {
      throw new Error("link not found");
    }
    if (resp.status === 410) {
      throw new Error("link expired");
    }
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  function renderMeta(meta) {
    $("meta-block").hidden = false;
    $("meta-subject").textContent = meta.subject_hint || "(no subject)";
    if (meta.expires_at) {
      $("meta-expires").textContent = new Date(meta.expires_at).toLocaleString();
    }
    if (typeof meta.views_remaining === "number") {
      $("row-views").hidden = false;
      $("meta-views").textContent = String(meta.views_remaining) + " of " + String(meta.max_views);
    }
    if (meta.expired) {
      $("phase-locked").hidden = true;
      $("phase-burned").hidden = false;
      setStatus("burned");
    } else {
      setStatus("locked · awaiting password");
    }
  }

  async function unlockAndDecrypt(token, password) {
    const resp = await fetch(`/api/v1/protected-links/${encodeURIComponent(token)}/open`, {
      method: "POST", credentials: "omit",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (resp.status === 410) throw new Error("link expired or all views consumed");
    if (resp.status === 404) throw new Error("link not found");
    if (resp.status === 429) throw new Error("too many attempts — slow down");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const j = await resp.json();
    const salt = b64ToBytes(j.kdf_salt_b64);
    const wrapped = b64ToBytes(j.wrapped_msg_key_b64);
    const cipher = b64ToBytes(j.ciphertext_b64);
    let params = {};
    try { params = j.kdf_params_json && (typeof j.kdf_params_json === "string" ? JSON.parse(j.kdf_params_json) : j.kdf_params_json); } catch (_) {}
    const kek = await deriveKEK(password, salt, j.kdf, params);
    const msgKey = await aesUnwrap(kek, wrapped);
    const plain = await aesOpen(msgKey, cipher);
    msgKey.fill(0);
    return { text: bytesToUtf8(plain), viewsRemaining: j.views_remaining, burned: j.burned };
  }

  async function init() {
    const token = readToken();
    if (!token) {
      setStatus("error");
      setErr("no token in URL");
      return;
    }
    try {
      const meta = await loadMeta(token);
      renderMeta(meta);
    } catch (e) {
      setStatus("error");
      $("phase-locked").hidden = true;
      $("phase-burned").hidden = false;
      $("phase-burned").querySelector("p, .protected-burned");
      const burnedMsg = document.querySelector("#phase-burned .protected-burned");
      if (burnedMsg) burnedMsg.textContent = "▸ " + ((e && e.message) || String(e));
      return;
    }
    const form = document.getElementById("unlock-form");
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      const pw = $("pwd").value;
      if (!pw) {
        setErr("password required");
        return;
      }
      const btn = $("unlock-btn");
      btn.disabled = true;
      setErr("");
      setStatus("decrypting…");
      try {
        const r = await unlockAndDecrypt(token, pw);
        const envelope = parseMimeEnvelope(r.text);
        $("phase-locked").hidden = true;
        $("phase-decrypted").hidden = false;
        renderDecryptedBody(envelope);
        renderAttachments(envelope.attachments || []);
        if (r.burned) {
          setStatus("burned · last view");
        } else if (typeof r.viewsRemaining === "number" && r.viewsRemaining >= 0) {
          setStatus("decrypted · " + r.viewsRemaining + " views remain");
        } else {
          setStatus("decrypted");
        }
      } catch (e) {
        setStatus("locked · awaiting password");
        setErr((e && e.message) ? e.message : String(e));
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
