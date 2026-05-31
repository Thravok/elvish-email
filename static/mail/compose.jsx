// ELVISH MAIL — compose modal with two user-facing send modes.
//
//   Mode A · PGP DIRECT     — paste-or-fetch recipient public key; payload is
//                             PGP-encrypted in the browser to that key.
//   Mode B · PROTECTED LINK — sender chooses a password; client AES-GCMs the
//                             message body with a random msg key and KEK-wraps
//                             the msg key. Only ciphertext + KDF params land
//                             on the server. Recipient unlocks in browser at
//                             /m/{token} with the out-of-band-shared password.

import * as React from "react";
import { stripHtmlBlocks, decodeHtmlEntities, innerPlain } from "./html-plaintext.js";

(function () {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;

  const TTL_OPTIONS = [
    { v: 60 * 60, label: "1 hour" },
    { v: 24 * 60 * 60, label: "24 hours" },
    { v: 7 * 24 * 60 * 60, label: "7 days (default)" },
    { v: 30 * 24 * 60 * 60, label: "30 days (max)" },
  ];

  const MAXVIEWS_OPTIONS = [
    { v: 0, label: "unlimited" },
    { v: 1, label: "1 view (burn after read)" },
    { v: 5, label: "5 views" },
    { v: 10, label: "10 views" },
  ];

  function passwordStrength(pw) {
    if (!pw) return { score: 0, label: "—" };
    let s = 0;
    if (pw.length >= 12) s++;
    if (pw.length >= 16) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const labels = ["weak", "weak", "ok", "good", "strong", "strong"];
    return { score: s, label: labels[Math.min(s, 5)] };
  }

  function bytesToB64(b) {
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function utf8(s) { return new TextEncoder().encode(s); }

  /** Split To/Cc/Bcc on commas or semicolons; keeps tokens inside angle brackets together. */
  function splitAddressList(value) {
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
      if ((c === "," || c === ";") && depth === 0) {
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

  function canonicalEmailToken(display) {
    const raw = String(display || "").trim();
    if (!raw) return "";
    const bracket = raw.match(/<\s*([^<>\s@]+@[^<>\s@]+)\s*>/);
    if (bracket && bracket[1]) return bracket[1].trim().toLowerCase();
    const bare = raw.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (bare && bare[1]) return bare[1].trim().toLowerCase();
    return raw.toLowerCase();
  }

  function toRecipientsForPGP(toField) {
    return splitAddressList(toField).map(canonicalEmailToken).filter(Boolean);
  }

  function singleComposeRecipient(toField) {
    const xs = toRecipientsForPGP(toField);
    return xs.length === 1 ? xs[0] : "";
  }

  function buildHeaderStub({ from, to, cc, bcc, subject, attachmentSummaries, inReplyTo, references }) {
    const out = {
      subject: subject || "",
      from: from || "",
      to: Array.isArray(to) ? to : [],
      cc: Array.isArray(cc) ? cc : [],
    };
    if (Array.isArray(bcc) && bcc.length > 0) out.bcc = bcc;
    if (inReplyTo) out.in_reply_to = String(inReplyTo).trim();
    if (references) out.references = String(references).trim();
    if (Array.isArray(attachmentSummaries) && attachmentSummaries.length > 0) {
      out.attachments = attachmentSummaries;
    }
    return out;
  }

  /** Primary email from a From header value, for stable attachment filenames. */
  function extractPrimaryEmailForFilename(fromValue) {
    const raw = String(fromValue || "").trim();
    const bracket = raw.match(/<\s*([^<>\s@]+@[^<>\s@]+)\s*>/);
    if (bracket && bracket[1]) return bracket[1].trim().toLowerCase();
    const bare = raw.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (bare && bare[1]) return bare[1].trim().toLowerCase();
    return "sender";
  }

  function publicKeyAscFilename(fromValue) {
    const email = extractPrimaryEmailForFilename(fromValue);
    const safe = email.replace(/[^a-z0-9._-]+/gi, "_");
    return `public-${safe}.asc`;
  }

  function buildSenderPublicKeyAttachmentSummary(fromValue, armoredPub) {
    const arm = String(armoredPub || "").trim();
    if (!arm) return null;
    const keyBlock = normalizeCRLF(arm) + "\r\n";
    const bytes = utf8(keyBlock);
    return {
      file_name: publicKeyAscFilename(fromValue),
      content_type: "application/pgp-keys",
      size_bytes: bytes.length,
    };
  }

  function normalizeCRLF(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "\r\n");
  }

  function randomHex(bytes = 16) {
    const out = new Uint8Array(bytes);
    crypto.getRandomValues(out);
    return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function extractDomain(from) {
    const raw = String(from || "").trim();
    const bracketMatch = raw.match(/<\s*[^<>\s@]+@([^<>\s@]+)\s*>/);
    if (bracketMatch && bracketMatch[1]) return bracketMatch[1].toLowerCase();
    const directMatch = raw.match(/^[^<>\s@]+@([^<>\s@]+)$/);
    if (directMatch && directMatch[1]) return directMatch[1].toLowerCase();
    return "elvish.local";
  }

  function buildPGPMIMEMessage({ from, to, cc, subject, armoredCiphertext, inReplyTo, references }) {
    const boundary = `=_elvish_${randomHex(16)}`;
    const messageID = `${Date.now()}.${randomHex(16)}@${extractDomain(from)}`;
    const normalizedCiphertext = normalizeCRLF(armoredCiphertext).replace(/\r\n$/, "");
    const ccList = Array.isArray(cc) ? cc.filter(Boolean) : [];
    const irt = String(inReplyTo || "").trim();
    const refs = String(references || "").trim();
    const lines = [
      `Message-ID: <${messageID}>`,
      `Date: ${new Date().toUTCString()}`,
      `From: ${from || "anonymous"}`,
      `To: ${(to || []).join(", ")}`,
    ];
    if (ccList.length > 0) lines.push(`Cc: ${ccList.join(", ")}`);
    if (subject) lines.push(`Subject: ${subject}`);
    if (irt) lines.push(`In-Reply-To: ${irt}`);
    if (refs) lines.push(`References: ${refs}`);
    lines.push(`Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="${boundary}"`);
    lines.push("MIME-Version: 1.0");
    lines.push("");
    lines.push("This is an OpenPGP/MIME encrypted message.");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: application/pgp-encrypted");
    lines.push("Content-Description: PGP/MIME version identification");
    lines.push("");
    lines.push("Version: 1");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: application/octet-stream; name="encrypted.asc"');
    lines.push('Content-Disposition: inline; filename="encrypted.asc"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(normalizedCiphertext);
    lines.push(`--${boundary}--`);
    lines.push("");
    return lines.join("\r\n");
  }

  // ---- Mode A: PGP direct -------------------------------------------------

  async function sendPGPDirect({
    from,
    recipient,
    subject,
    body,
    recipientArmored,
    senderArmored,
    senderFingerprint,
    localDelivery,
    attachPublicKey,
    ccDisplay,
    bccDisplay,
    inReplyTo,
    references,
  }) {
    if (!window.openpgp || !window.ElvishKeyVault) throw new Error("crypto subsystem not loaded");
    const recipients = [recipient];
    const ccList = Array.isArray(ccDisplay) ? ccDisplay.filter(Boolean) : splitAddressList(ccDisplay || "");
    const bccList = Array.isArray(bccDisplay) ? bccDisplay.filter(Boolean) : splitAddressList(bccDisplay || "");
    const wantAttach = !!(attachPublicKey && senderArmored && String(senderArmored).trim());
    const attachmentSummaries = wantAttach
      ? [buildSenderPublicKeyAttachmentSummary(from, senderArmored)].filter(Boolean)
      : [];
    const irt = String(inReplyTo || "").trim();
    const refs = String(references || "").trim();
    const rfcOpts = {
      attachPublicKey: wantAttach,
      senderArmoredPublic: senderArmored,
      ccDisplay: ccList,
      bccDisplay: bccList,
      inReplyTo: irt,
      references: refs,
    };
    const headerPayload = buildHeaderStub({
      from,
      to: recipients,
      cc: ccList.map(canonicalEmailToken).filter(Boolean),
      bcc: bccList.map(canonicalEmailToken).filter(Boolean),
      subject,
      attachmentSummaries,
      inReplyTo: irt,
      references: refs,
    });
    const rfc822 = buildRFC5322(from, recipients, subject, body, rfcOpts);
    const armoredBody = await window.ElvishKeyVault.encryptAndSignToRecipient(recipientArmored, rfc822, senderFingerprint);
    const bodyCiphertextB64 = bytesToB64(utf8(armoredBody));
    let senderHeaderCiphertextB64 = "";
    let senderBodyCiphertextB64 = "";
    if (senderArmored) {
      const senderArmoredBody = await window.ElvishKeyVault.encryptAndSignToRecipient(senderArmored, rfc822, senderFingerprint);
      const senderHeaderCiphertext = await window.ElvishKeyVault.encryptToRecipient(
        senderArmored,
        JSON.stringify(headerPayload),
      );
      senderBodyCiphertextB64 = bytesToB64(utf8(senderArmoredBody));
      senderHeaderCiphertextB64 = bytesToB64(utf8(senderHeaderCiphertext));
    }
    if (localDelivery) {
      const headerCiphertext = await window.ElvishKeyVault.encryptToRecipient(
        recipientArmored,
        JSON.stringify(headerPayload),
      );
      return window.ElvishMailManifest.postEncryptedMessage({
        recipient,
        headerCiphertextB64: bytesToB64(utf8(headerCiphertext)),
        bodyCiphertextB64,
        senderHeaderCiphertextB64,
        senderBodyCiphertextB64,
        fromAddr: from,
        toAddrs: recipients,
      });
    }
    const outboundPGPMIME = buildPGPMIMEMessage({
      from,
      to: recipients,
      cc: ccList,
      subject,
      armoredCiphertext: armoredBody,
      inReplyTo: irt,
      references: refs,
    });
    return window.ElvishMailManifest.postOutbox({
      payloadCiphertextB64: bytesToB64(utf8(outboundPGPMIME)),
      recipientSummary: recipients,
      senderHeaderCiphertextB64,
      senderBodyCiphertextB64,
      fromAddr: from,
    });
  }

  // ---- Mode B: protected link --------------------------------------------

  async function sendProtectedLink({ from, to, cc, subject, body, password, ttlSeconds, maxViews, notify }) {
    if (!window.ElvishKeygen) throw new Error("crypto subsystem not loaded");
    const rawList = [...splitAddressList(to), ...splitAddressList(cc || "")];
    const seen = new Set();
    const recipients = [];
    for (const disp of rawList) {
      const c = canonicalEmailToken(disp);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      recipients.push(c);
    }
    const fullBody = `From: ${from || "anonymous"}\r\nSubject: ${subject || "(no subject)"}\r\n\r\n${body || ""}`;
    const msgKeyBytes = window.ElvishKeygen.randomBytes(32);
    const msgKey = await crypto.subtle.importKey("raw", msgKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
    const msgNonce = window.ElvishKeygen.randomBytes(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: msgNonce }, msgKey, utf8(fullBody)));
    const payloadCt = new Uint8Array(msgNonce.length + ct.length);
    payloadCt.set(msgNonce, 0);
    payloadCt.set(ct, msgNonce.length);

    const salt = window.ElvishKeygen.randomBytes(16);
    const { kdf, key: kek, params } = await window.ElvishKeygen.deriveKEK(password, salt);
    const wrapped = await window.ElvishKeygen.aesWrap(kek, msgKeyBytes);
    msgKeyBytes.fill(0);

    const r = await window.ElvishMailManifest.createProtectedLink({
      subject_hint: subject || "",
      recipient_emails: recipients,
      notify_recipients: !!notify,
      notify_from_addr: from || "",
      ttl_seconds: ttlSeconds,
      max_views: maxViews,
      kdf,
      kdf_salt_b64: bytesToB64(salt),
      kdf_params_json: JSON.stringify(params || {}),
      wrapped_msg_key_b64: bytesToB64(wrapped),
      body_ciphertext_b64: bytesToB64(payloadCt),
    });
    return r;
  }

  // ---- helpers -----------------------------------------------------------

  function buildRFC5322(from, to, subject, body, opts) {
    const o = opts || {};
    const wantAttach = !!(o.attachPublicKey && o.senderArmoredPublic && String(o.senderArmoredPublic).trim());
    const ccJoin = (o.ccDisplay || []).filter(Boolean).join(", ");
    const bccJoin = (o.bccDisplay || []).filter(Boolean).join(", ");
    const irt = String(o.inReplyTo || "").trim();
    const refs = String(o.references || "").trim();
    const pushAddrHeaders = (lines) => {
      lines.push(`To: ${(to || []).join(", ")}`);
      if (ccJoin) lines.push(`Cc: ${ccJoin}`);
      if (bccJoin) lines.push(`Bcc: ${bccJoin}`);
      lines.push(`Subject: ${subject || "(no subject)"}`);
      if (irt) lines.push(`In-Reply-To: ${irt}`);
      if (refs) lines.push(`References: ${refs}`);
    };
    if (!wantAttach) {
      const lines = [];
      lines.push(`Date: ${new Date().toUTCString()}`);
      lines.push(`From: ${from || "anonymous"}`);
      pushAddrHeaders(lines);
      lines.push('Content-Type: text/plain; charset="utf-8"; protected-headers="v1"');
      lines.push("Content-Transfer-Encoding: 8bit");
      lines.push("MIME-Version: 1.0");
      lines.push("");
      lines.push(body || "");
      return utf8(lines.join("\r\n"));
    }
    const fn = publicKeyAscFilename(from);
    const boundary = `=_elvish_mix_${randomHex(12)}`;
    const keyBody = normalizeCRLF(String(o.senderArmoredPublic).trim()).replace(/\r\n$/, "");
    const head = [
      `Date: ${new Date().toUTCString()}`,
      `From: ${from || "anonymous"}`,
    ];
    pushAddrHeaders(head);
    head.push(
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"; protected-headers="v1"',
      "Content-Transfer-Encoding: 8bit",
      "",
      body || "",
      "",
      `--${boundary}`,
      `Content-Type: application/pgp-keys; name="${fn}"`,
      `Content-Disposition: attachment; filename="${fn}"`,
      "Content-Transfer-Encoding: 7bit",
      "",
      keyBody,
      "",
      `--${boundary}--`,
      "",
    );
    const text = head.join("\r\n");
    return utf8(text);
  }

  // ---- Rich Text Editor --------------------------------------------------

  const EditorIcons = {
    bold: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
    italic: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
    underline: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
    strikethrough: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 7.5c-.5-1.5-2-3-5.5-3s-5.5 2-5.5 4c0 3 3 4 7 4.5"/><path d="M8 16.5c.5 1 2 2.5 5 2.5s4.5-1.5 5-3"/></svg>,
    heading1: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 10l3-2v12"/></svg>,
    heading2: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>,
    bulletList: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>,
    numberedList: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>,
    blockquote: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"/></svg>,
    code: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    clearFormat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="3" y1="3" x2="21" y2="21" strokeWidth="2"/></svg>,
    expand: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
    collapse: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  };

  function htmlToPlainText(html) {
    if (!html || typeof html !== "string") return "";
    let text = stripHtmlBlocks(html);
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => "\n# " + innerPlain(content) + "\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => "\n## " + innerPlain(content) + "\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => "\n### " + innerPlain(content) + "\n");
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const lines = innerPlain(content).split("\n");
      return "\n" + lines.map((l) => `> ${l.trim()}`).join("\n") + "\n";
    });
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, content) => "\n```\n" + innerPlain(content) + "\n```\n");
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, content) => "`" + innerPlain(content) + "`");
    text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      return "\n" + items.map((item) => "- " + innerPlain(item.replace(/<\/?li[^>]*>/gi, ""))).join("\n") + "\n";
    });
    text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      return "\n" + items.map((item, i) => `${i + 1}. ` + innerPlain(item.replace(/<\/?li[^>]*>/gi, ""))).join("\n") + "\n";
    });
    text = text.replace(/<a[^>]+href=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
      const linkText = innerPlain(content);
      if (linkText === href || !linkText) return href;
      return `${linkText} (${href})`;
    });
    text = text.replace(/<a[^>]+href=\s*'([^']*)'[^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
      const linkText = innerPlain(content);
      if (linkText === href || !linkText) return href;
      return `${linkText} (${href})`;
    });
    text = text.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/(b|strong)>/gi, (_, _o, content) => "**" + innerPlain(content) + "**");
    text = text.replace(/<(i|em)[^>]*>([\s\S]*?)<\/(i|em)>/gi, (_, _o, content) => "_" + innerPlain(content) + "_");
    text = text.replace(/<(u)[^>]*>([\s\S]*?)<\/(u)>/gi, (_, _o, content) => innerPlain(content));
    text = text.replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/(s|strike|del)>/gi, (_, _o, content) => "~" + innerPlain(content) + "~");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = innerPlain(text);
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  function sanitizeComposeHtml(html) {
    const raw = String(html || "");
    const p = typeof globalThis !== "undefined" && globalThis.DOMPurify;
    if (p && typeof p.sanitize === "function") {
      return p.sanitize(raw, { USE_PROFILES: { html: true } });
    }
    // Bundles ship DOMPurify; if it is missing, never assign unsanitized HTML to the editor.
    const d = document.createElement("div");
    d.textContent = raw;
    return d.innerHTML;
  }

  function EditorToolbar({ editorRef, expanded, onToggleExpanded }) {
    const execCommand = useCallback((cmd, value = null) => {
      document.execCommand(cmd, false, value);
      editorRef.current?.focus();
    }, [editorRef]);

    const formatBlock = useCallback((tag) => {
      document.execCommand("formatBlock", false, tag);
      editorRef.current?.focus();
    }, [editorRef]);

    const insertLink = useCallback(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || "";
      const url = prompt("Enter URL:", selectedText.startsWith("http") ? selectedText : "https://");
      if (url) {
        document.execCommand("createLink", false, url);
        editorRef.current?.focus();
      }
    }, [editorRef]);

    const clearFormatting = useCallback(() => {
      document.execCommand("removeFormat", false, null);
      document.execCommand("formatBlock", false, "p");
      editorRef.current?.focus();
    }, [editorRef]);

    return (
      <div className="mail-editor-toolbar">
        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("bold")}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            {EditorIcons.bold}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("italic")}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            {EditorIcons.italic}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("underline")}
            title="Underline (Ctrl+U)"
            aria-label="Underline"
          >
            {EditorIcons.underline}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("strikeThrough")}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            {EditorIcons.strikethrough}
          </button>
        </div>

        <div className="mail-editor-toolbar-sep"></div>

        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => formatBlock("h1")}
            title="Heading 1"
            aria-label="Heading 1"
          >
            {EditorIcons.heading1}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => formatBlock("h2")}
            title="Heading 2"
            aria-label="Heading 2"
          >
            {EditorIcons.heading2}
          </button>
        </div>

        <div className="mail-editor-toolbar-sep"></div>

        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("insertUnorderedList")}
            title="Bullet list"
            aria-label="Bullet list"
          >
            {EditorIcons.bulletList}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => execCommand("insertOrderedList")}
            title="Numbered list"
            aria-label="Numbered list"
          >
            {EditorIcons.numberedList}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => formatBlock("blockquote")}
            title="Blockquote"
            aria-label="Blockquote"
          >
            {EditorIcons.blockquote}
          </button>
        </div>

        <div className="mail-editor-toolbar-sep"></div>

        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn"
            onClick={insertLink}
            title="Insert link (Ctrl+K)"
            aria-label="Insert link"
          >
            {EditorIcons.link}
          </button>
          <button
            type="button"
            className="mail-editor-btn"
            onClick={() => formatBlock("pre")}
            title="Code block"
            aria-label="Code block"
          >
            {EditorIcons.code}
          </button>
        </div>

        <div className="mail-editor-toolbar-sep"></div>

        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn"
            onClick={clearFormatting}
            title="Clear formatting"
            aria-label="Clear formatting"
          >
            {EditorIcons.clearFormat}
          </button>
        </div>

        <div className="mail-editor-toolbar-spacer"></div>

        <div className="mail-editor-toolbar-group">
          <button
            type="button"
            className="mail-editor-btn mail-editor-btn-expand"
            onClick={onToggleExpanded}
            title={expanded ? "Collapse (Esc)" : "Expand editor"}
            aria-label={expanded ? "Collapse editor" : "Expand editor"}
          >
            {expanded ? EditorIcons.collapse : EditorIcons.expand}
          </button>
        </div>
      </div>
    );
  }

  function RichTextEditor({ value, onChange, placeholder, mode, expanded, onToggleExpanded }) {
    const editorRef = useRef(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
      if (editorRef.current && !isInitializedRef.current) {
        if (value) {
          editorRef.current.innerHTML = sanitizeComposeHtml(value);
        }
        isInitializedRef.current = true;
      }
    }, []);

    useEffect(() => {
      if (!expanded) return;
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onToggleExpanded();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [expanded, onToggleExpanded]);

    const handleInput = useCallback(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, [onChange]);

    const handleKeyDown = useCallback((e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "b") {
        e.preventDefault();
        document.execCommand("bold", false, null);
      } else if (isMod && e.key === "i") {
        e.preventDefault();
        document.execCommand("italic", false, null);
      } else if (isMod && e.key === "u") {
        e.preventDefault();
        document.execCommand("underline", false, null);
      } else if (isMod && e.key === "k") {
        e.preventDefault();
        const selection = window.getSelection();
        const selectedText = selection?.toString() || "";
        const url = prompt("Enter URL:", selectedText.startsWith("http") ? selectedText : "https://");
        if (url) {
          document.execCommand("createLink", false, url);
        }
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        document.execCommand("strikeThrough", false, null);
      }
    }, []);

    const handlePaste = useCallback((e) => {
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const html = clipboardData.getData("text/html");
      const text = clipboardData.getData("text/plain");
      if (html) {
        const sanitized = sanitizeComposeHtml(html);
        document.execCommand("insertHTML", false, sanitized);
      } else if (text) {
        document.execCommand("insertText", false, text);
      }
      handleInput();
    }, [handleInput]);

    const placeholderText = mode === "pgp"
      ? "Body (will be PGP-encrypted to recipient)"
      : "Body (will be AES-GCM-encrypted under your password)";

    const editorContent = (
      <div className={`mail-editor-wrapper ${expanded ? "expanded" : ""}`}>
        <EditorToolbar
          editorRef={editorRef}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
        />
        <div
          ref={editorRef}
          className="mail-editor-content"
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder || placeholderText}
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
        />
      </div>
    );

    if (expanded) {
      return (
        <div className="mail-compose-expanded-overlay">
          <div className="mail-compose-expanded">
            <div className="mail-compose-expanded-header">
              <span className="kind">▸ EXPANDED</span>
              <span className="title">Compose</span>
              <button
                type="button"
                className="mail-compose-expanded-close"
                onClick={onToggleExpanded}
                aria-label="Close expanded view"
              >
                ×
              </button>
            </div>
            <div className="mail-compose-expanded-body">
              {editorContent}
            </div>
            <div className="mail-compose-expanded-footer">
              <span className="hint">Press Esc to exit expanded mode</span>
            </div>
          </div>
        </div>
      );
    }

    return editorContent;
  }

  // ---- React UI ----------------------------------------------------------

  function FromSelector({ value, options, identities, onChange }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      const handleEscape = (e) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [open]);

    const getIdentityForEmail = (email) => {
      if (!Array.isArray(identities)) return null;
      return identities.find((i) => i && i.email === email);
    };

    const getInitial = (email) => {
      if (!email) return "?";
      const local = email.split("@")[0];
      return (local[0] || "?").toUpperCase();
    };

    const getAvatarStyle = (email) => {
      if (!email) return {};
      let hash = 0;
      for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return {
        "--from-avatar-bg": `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${(hue + 40) % 360}, 50%, 35%))`,
      };
    };

    const selectedIdentity = getIdentityForEmail(value);

    return (
      <div className="from-selector" ref={containerRef}>
        <button
          type="button"
          className={`from-selector-trigger${open ? " open" : ""}`}
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="from-selector-avatar" style={getAvatarStyle(value)}>
            {getInitial(value)}
          </span>
          <span className="from-selector-value">
            <span className="from-selector-email">{value || "Select identity"}</span>
            {selectedIdentity && selectedIdentity.fingerprint && (
              <span className="from-selector-fp">{selectedIdentity.fingerprint.slice(-8).toUpperCase()}</span>
            )}
          </span>
          <span className="from-selector-chevron">{open ? "▴" : "▾"}</span>
        </button>

        {open && (
          <div className="from-selector-menu" role="listbox">
            <div className="from-selector-menu-header">
              <span className="from-selector-menu-label">▸ SELECT IDENTITY</span>
            </div>
            {options.map((opt) => {
              const identity = getIdentityForEmail(opt);
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  className={`from-selector-option${isSelected ? " selected" : ""}`}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="from-selector-avatar" style={getAvatarStyle(opt)}>
                    {getInitial(opt)}
                  </span>
                  <span className="from-selector-option-content">
                    <span className="from-selector-option-email">{opt}</span>
                    {identity && identity.fingerprint && (
                      <span className="from-selector-option-fp">
                        Key: {identity.fingerprint.slice(-16).toUpperCase()}
                      </span>
                    )}
                  </span>
                  {isSelected && <span className="from-selector-check">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function ElvishMailCompose({ open, onClose, initialDraft, identities, defaultFrom, onToast }) {
    const [mode, setMode] = useState("pgp");
    const [from, setFrom] = useState(defaultFrom || "");
    const [to, setTo] = useState("");
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [showCc, setShowCc] = useState(false);
    const [inReplyTo, setInReplyTo] = useState("");
    const [references, setReferences] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    // PGP direct
    const [recipientArmored, setRecipientArmored] = useState("");
    const [recipientMeta, setRecipientMeta] = useState(null);
    const [keyError, setKeyError] = useState("");
    const [saveToAddressBook, setSaveToAddressBook] = useState(true);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [keyStatus, setKeyStatus] = useState("idle");
    const [manualKeyOverride, setManualKeyOverride] = useState(false);
    const [manualKeyEmail, setManualKeyEmail] = useState("");
    const [uploadedKeyName, setUploadedKeyName] = useState("");
    // Protected link
    const [pwd, setPwd] = useState("");
    const [pwdConfirm, setPwdConfirm] = useState("");
    const [ttlSeconds, setTtlSeconds] = useState(7 * 24 * 60 * 60);
    const [maxViews, setMaxViews] = useState(0);
    const [notify, setNotify] = useState(true);
    const [linkResult, setLinkResult] = useState(null);
    const [attachPublicKey, setAttachPublicKey] = useState(false);
    // Rich text editor
    const [expanded, setExpanded] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    // Common
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const lookupSeqRef = useRef(0);
    useEffect(() => {
      if (!open) {
        setBody("");
        setSubject("");
        setTo("");
        setCc("");
        setBcc("");
        setShowCc(false);
        setInReplyTo("");
        setReferences("");
        setRecipientArmored("");
        setRecipientMeta(null);
        setKeyError("");
        setKeyStatus("idle");
        setManualKeyOverride(false);
        setManualKeyEmail("");
        setUploadedKeyName("");
        setLookupBusy(false);
        setPwd("");
        setPwdConfirm("");
        setLinkResult(null);
        setErr("");
        setMode("pgp");
        setAttachPublicKey(false);
        setExpanded(false);
      } else {
        setEditorKey((k) => k + 1);
        if (initialDraft && typeof initialDraft === "object") {
          const d = initialDraft;
          if (d.to != null) setTo(String(d.to));
          else setTo("");
          if (d.cc != null) setCc(String(d.cc));
          else setCc("");
          if (d.bcc != null) setBcc(String(d.bcc));
          else setBcc("");
          if (d.subject != null) setSubject(String(d.subject));
          else setSubject("");
          if (d.bodyHtml != null) setBody(String(d.bodyHtml));
          else setBody("");
          setShowCc(!!d.showCc);
          setInReplyTo(d.inReplyTo != null ? String(d.inReplyTo) : "");
          setReferences(d.references != null ? String(d.references) : "");
        } else {
          setTo("");
          setCc("");
          setBcc("");
          setSubject("");
          setBody("");
          setShowCc(false);
          setInReplyTo("");
          setReferences("");
        }
        if (defaultFrom) setFrom(defaultFrom);
      }
    }, [open, initialDraft, defaultFrom]);

    useEffect(() => {
      if (!open) return;
      if (!window.ElvishMailManifest || typeof window.ElvishMailManifest.getMailSettings !== "function") {
        setAttachPublicKey(false);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const payload = await window.ElvishMailManifest.getMailSettings();
          if (cancelled) return;
          const st = payload && payload.settings ? payload.settings : {};
          setAttachPublicKey(!!st.attach_public_key_default);
        } catch (_) {
          if (!cancelled) setAttachPublicKey(false);
        }
      })();
      return () => { cancelled = true; };
    }, [open]);

    const detectRecipientKey = useCallback(async ({ force = false } = {}) => {
      const recipients = toRecipientsForPGP(to);
      if (recipients.length === 0) {
        setKeyStatus("idle");
        if (force) setKeyError("enter a recipient first");
        return null;
      }
      if (recipients.length !== 1) {
        setKeyStatus("needs-single");
        if (force) setKeyError("PGP direct encrypts to one To address (Cc/Bcc are copied on headers only)");
        return null;
      }
      const target = recipients[0];
      const preserveManual = manualKeyOverride && manualKeyEmail === target && !!recipientArmored;
      const seq = ++lookupSeqRef.current;
      setLookupBusy(true);
      if (force) setKeyError("");
      setKeyStatus("checking");
      try {
        const contactHit = await window.ElvishMailManifest.getContactKey(target);
        if (seq !== lookupSeqRef.current) return null;
        let hit = contactHit && contactHit.armored_public ? contactHit : null;
        if (!hit) {
          const lookupHit = await window.ElvishMailManifest.lookupKey(target);
          if (seq !== lookupSeqRef.current) return null;
          hit = lookupHit && lookupHit.armored_public ? lookupHit : null;
        }
        if (!hit) {
          setKeyStatus("missing");
          if (!preserveManual) {
            setRecipientArmored("");
            setRecipientMeta(null);
          }
          if (force) setKeyError("no key found for " + target);
          return null;
        }
        const meta = {
          source: hit.source || (contactHit ? "address-book" : "?"),
          fingerprint: hit.fingerprint,
          email: target,
          armoredPublic: hit.armored_public,
        };
        setKeyStatus("found");
        if (!preserveManual) {
          setRecipientArmored(hit.armored_public);
          setRecipientMeta(meta);
          setManualKeyOverride(false);
          setManualKeyEmail("");
          setUploadedKeyName("");
        }
        return meta;
      } catch (e) {
        if (seq !== lookupSeqRef.current) return null;
        setKeyStatus("error");
        if (!preserveManual) setRecipientMeta(null);
        if (force) setKeyError((e && e.message) || String(e));
        return null;
      } finally {
        if (seq === lookupSeqRef.current) setLookupBusy(false);
      }
    }, [to, manualKeyOverride, manualKeyEmail, recipientArmored]);

    // Dynamically check whether the current recipient already has an available key.
    useEffect(() => {
      if (mode !== "pgp") {
        lookupSeqRef.current += 1;
        setLookupBusy(false);
        return;
      }
      const recipients = toRecipientsForPGP(to);
      if (recipients.length === 0) {
        lookupSeqRef.current += 1;
        setLookupBusy(false);
        setKeyStatus("idle");
        if (!manualKeyOverride) {
          setRecipientArmored("");
          setRecipientMeta(null);
        }
        return;
      }
      if (recipients.length !== 1) {
        lookupSeqRef.current += 1;
        setLookupBusy(false);
        setKeyStatus("needs-single");
        if (!manualKeyOverride) {
          setRecipientArmored("");
          setRecipientMeta(null);
        }
        return;
      }
      const id = setTimeout(() => { detectRecipientKey(); }, 350);
      return () => clearTimeout(id);
    }, [to, mode, manualKeyOverride, detectRecipientKey]);

    const fetchRecipientKey = useCallback(async () => {
      await detectRecipientKey({ force: true });
    }, [detectRecipientKey]);

    const handleManualKeyChange = useCallback((nextValue) => {
      const next = String(nextValue || "");
      const trimmed = next.trim();
      const target = singleComposeRecipient(to);
      setRecipientArmored(next);
      setUploadedKeyName("");
      setKeyError("");
      if (trimmed) {
        setManualKeyOverride(true);
        setManualKeyEmail(target);
        setRecipientMeta({
          source: "manual",
          fingerprint: recipientMeta && String(recipientMeta.source || "").startsWith("manual")
            ? recipientMeta.fingerprint
            : "",
          email: target,
          armoredPublic: next,
        });
        setKeyStatus("manual");
        return;
      }
      setManualKeyOverride(false);
      setManualKeyEmail("");
      setRecipientMeta(null);
      setKeyStatus("idle");
    }, [to, recipientMeta]);

    const clearManualKey = useCallback(() => {
      setRecipientArmored("");
      setRecipientMeta(null);
      setManualKeyOverride(false);
      setManualKeyEmail("");
      setUploadedKeyName("");
      setKeyError("");
      setKeyStatus("idle");
    }, []);

    const handleManualKeyUpload = useCallback(async (file) => {
      if (!file) return;
      setKeyError("");
      try {
        const armored = String(await file.text()).trim();
        if (!armored) throw new Error("public key file is empty");
        if (/BEGIN PGP PRIVATE KEY/i.test(armored) || /BEGIN PRIVATE KEY/i.test(armored)) {
          throw new Error("private key material is not allowed here");
        }
        let fingerprint = "";
        if (window.ElvishKeygen && window.ElvishKeygen.pgpFingerprint) {
          fingerprint = await window.ElvishKeygen.pgpFingerprint(armored);
        } else if (window.openpgp) {
          const key = await window.openpgp.readKey({ armoredKey: armored });
          fingerprint = String(key.getFingerprint() || "").toUpperCase();
        }
        const target = singleComposeRecipient(to);
        setRecipientArmored(armored);
        setRecipientMeta({
          source: "manual upload",
          fingerprint,
          email: target,
          armoredPublic: armored,
        });
        setManualKeyOverride(true);
        setManualKeyEmail(target);
        setUploadedKeyName(file.name || "");
        setKeyStatus("manual");
      } catch (e) {
        setKeyError((e && e.message) || String(e));
      }
    }, [to]);

    const handleSend = useCallback(async () => {
      if (busy) return;
      setErr("");
      setBusy(true);
      const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
      const plainTextBody = htmlToPlainText(body);
      try {
        if (mode === "pgp") {
          const recipients = toRecipientsForPGP(to);
          const ccLines = splitAddressList(cc);
          const bccLines = splitAddressList(bcc);
          if (recipients.length === 0) throw new Error("recipient (To:) required");
          if (recipients.length !== 1) {
            throw new Error("PGP direct encrypts to exactly one To address. Cc/Bcc are added to headers only; use a protected link for multi-recipient delivery.");
          }
          const recipient = recipients[0];
          const manualTargetMatch = manualKeyOverride && manualKeyEmail === recipient && !!recipientArmored;
          let routingMeta = recipientMeta;
          if (!manualTargetMatch && (!routingMeta || routingMeta.email !== recipient)) {
            routingMeta = await detectRecipientKey({ force: true });
          }
          if (!recipientArmored && !(routingMeta && routingMeta.armoredPublic)) {
            throw new Error("recipient public key required");
          }
          const localDelivery = !manualTargetMatch && !!(routingMeta && routingMeta.source === "local" && routingMeta.email === recipient);
          const routeArmored = manualTargetMatch
            ? recipientArmored
            : (localDelivery && routingMeta && routingMeta.armoredPublic
            ? routingMeta.armoredPublic
            : (recipientArmored || (routingMeta && routingMeta.armoredPublic) || ""));
          const senderIdentity = (Array.isArray(identities) ? identities : []).find((i) => i && i.email === from);
          if (!senderIdentity || !senderIdentity.armored_public) throw new Error("sender identity public key unavailable");
          const senderFingerprint = senderIdentity.fingerprint
            || await window.ElvishKeyVault.ensureIdentityUnlockedByEmail(from);
          if (!senderFingerprint) throw new Error("sender identity signing key unavailable");
          const r = await sendPGPDirect({
            from,
            recipient,
            subject,
            body: plainTextBody,
            recipientArmored: routeArmored,
            senderArmored: senderIdentity.armored_public,
            senderFingerprint,
            localDelivery,
            attachPublicKey,
            ccDisplay: ccLines,
            bccDisplay: bccLines,
            inReplyTo,
            references,
          });
          const addressBookEntry = manualTargetMatch
            ? {
                email: recipient,
                armoredPublic: recipientArmored,
                source: uploadedKeyName ? "manual upload" : "manual",
              }
            : (routingMeta && routingMeta.email
                ? {
                    email: routingMeta.email,
                    armoredPublic: routeArmored,
                    source: routingMeta.source,
                  }
                : null);
          if (saveToAddressBook && addressBookEntry && addressBookEntry.email) {
            try {
              await window.ElvishMailManifest.putContactKey({
                email: addressBookEntry.email,
                armoredPublic: addressBookEntry.armoredPublic,
                source: addressBookEntry.source,
                trusted: true,
              });
            } catch (e) { console.warn("address-book save", e); }
          }
          if (onToast) {
            const message = localDelivery
              ? "Delivered signed PGP message locally"
              : "Queued signed PGP message · outbox " + (r && r.id ? r.id.slice(0, 8) : "");
            onToast({ type: "ok", message });
          }
          if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "compose_send", perfStartedAt, "success");
          onClose();
        } else if (mode === "link") {
          if (!pwd) throw new Error("password required");
          if (pwd.length < 12) throw new Error("password must be at least 12 chars");
          if (pwd !== pwdConfirm) throw new Error("passwords do not match");
          if (!plainTextBody) throw new Error("body required");
          const r = await sendProtectedLink({ from, to, cc, subject, body: plainTextBody, password: pwd, ttlSeconds, maxViews, notify });
          setLinkResult(r);
          if (onToast) onToast({ type: "ok", message: "Protected link created" });
          if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "compose_send", perfStartedAt, "success");
        }
      } catch (e) {
        if (window.ElvishPerf) window.ElvishPerf.end("mail_ui", "compose_send", perfStartedAt, "failure");
        setErr((e && e.message) || String(e));
      } finally {
        setBusy(false);
      }
    }, [mode, from, to, cc, bcc, subject, body, recipientArmored, recipientMeta, saveToAddressBook, identities,
        manualKeyOverride, manualKeyEmail, uploadedKeyName, detectRecipientKey, attachPublicKey,
        inReplyTo, references,
        pwd, pwdConfirm, ttlSeconds, maxViews, notify, busy, onClose, onToast]);

    const fromOptions = useMemo(() => {
      if (Array.isArray(identities) && identities.length > 0) {
        return identities.map((i) => i.email);
      }
      return defaultFrom ? [defaultFrom] : [];
    }, [identities, defaultFrom]);

    const pwdMeter = useMemo(() => passwordStrength(pwd), [pwd]);

    if (!open) return null;

    return (
      <div className="mail-compose">
        <span className="br-bl"></span>
        <span className="br-br"></span>

        <div className="mail-compose-header">
          <span className="kind">▸ COMPOSE</span>
          <span className="title">New Message</span>
          <button className="mail-compose-btn-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mail-compose-mode-bar">
          <button
            type="button"
            className={`mail-mode-btn ${mode === "pgp" ? "active" : ""}`}
            onClick={() => setMode("pgp")}
          >
            <span className="mail-mode-icon">⚿</span>
            <span>PGP Direct</span>
          </button>
          <button
            type="button"
            className={`mail-mode-btn ${mode === "link" ? "active" : ""}`}
            onClick={() => setMode("link")}
          >
            <span className="mail-mode-icon">🔗</span>
            <span>Protected Link</span>
          </button>
        </div>

        <div className="mail-compose-body">
          <div className="mail-compose-field">
            <span className="label">From</span>
            {fromOptions.length > 1 ? (
              <FromSelector
                value={from}
                options={fromOptions}
                identities={identities}
                onChange={setFrom}
              />
            ) : (
              <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="me@example.com" />
            )}
          </div>

          <div className="mail-compose-field">
            <span className="label">
              To
              {!showCc && (
                <button type="button" className="link-cc" onClick={() => setShowCc(true)}>
                  {mode === "link" ? "add Cc" : "Cc / Bcc"}
                </button>
              )}
            </span>
            <input
              type="text"
              placeholder={
                mode === "link"
                  ? "recipient(s) for the notification email (comma or semicolon)"
                  : "one address for PGP direct; comma between multiple for headers only"
              }
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {showCc && mode !== "link" && (
            <>
              <div className="mail-compose-field">
                <span className="label">Cc</span>
                <input
                  type="text"
                  placeholder="Optional; comma or semicolon between addresses"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div className="mail-compose-field">
                <span className="label">Bcc</span>
                <input
                  type="text"
                  placeholder="Optional; shown on inner headers only (not blind for PGP)"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                />
              </div>
            </>
          )}

          {showCc && mode === "link" && (
            <div className="mail-compose-field">
              <span className="label">Cc</span>
              <input
                type="text"
                placeholder="Additional addresses to notify (comma or semicolon)"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
          )}

          <div className="mail-compose-field">
            <span className="label">Subject</span>
            <input type="text" placeholder={mode === "link" ? "subject hint (visible in notification)" : "Subject"} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {mode === "pgp" && (
            <RecipientKeyPanel
              recipientTarget={singleComposeRecipient(to)}
              recipientArmored={recipientArmored}
              recipientMeta={recipientMeta}
              manualKeyOverride={manualKeyOverride}
              uploadedKeyName={uploadedKeyName}
              keyStatus={keyStatus}
              fetchKey={fetchRecipientKey}
              lookupBusy={lookupBusy}
              keyError={keyError}
              onManualKeyChange={handleManualKeyChange}
              onUploadKey={handleManualKeyUpload}
              onClearManualKey={clearManualKey}
              onUseProtectedLink={() => setMode("link")}
              saveToAddressBook={saveToAddressBook}
              setSaveToAddressBook={setSaveToAddressBook}
              attachPublicKey={attachPublicKey}
              setAttachPublicKey={setAttachPublicKey}
            />
          )}

          {mode === "link" && (
            <ProtectedLinkPanel
              pwd={pwd} setPwd={setPwd}
              pwdConfirm={pwdConfirm} setPwdConfirm={setPwdConfirm}
              meter={pwdMeter}
              ttlSeconds={ttlSeconds} setTtlSeconds={setTtlSeconds}
              maxViews={maxViews} setMaxViews={setMaxViews}
              notify={notify} setNotify={setNotify}
            />
          )}

          <RichTextEditor
            key={editorKey}
            value={body}
            onChange={setBody}
            mode={mode}
            expanded={expanded}
            onToggleExpanded={() => setExpanded(!expanded)}
          />

          {linkResult && mode === "link" && (
            <div className="mail-link-result">
              <div className="mail-link-result-h">▸ PROTECTED LINK CREATED</div>
              <div className="mail-link-row">
                <span className="k">URL</span>
                <input type="text" value={linkResult.url || ""} readOnly onFocus={(e) => e.target.select()} />
                <button className="btn-sm" onClick={() => navigator.clipboard.writeText(linkResult.url || "")}>Copy</button>
              </div>
              <div className="mail-link-row">
                <span className="k">Password</span>
                <input type="text" value={pwd} readOnly onFocus={(e) => e.target.select()} />
                <button className="btn-sm" onClick={() => navigator.clipboard.writeText(pwd)}>Copy</button>
              </div>
              <p className="mail-link-explain">
                Send the password to the recipient out-of-band (Signal, in person, etc.).
                {linkResult.expires_at && <> Expires {new Date(linkResult.expires_at).toLocaleString()}.</>}
                {linkResult.notify_sent && <> Notification email queued.</>}
              </p>
            </div>
          )}

          {err && <div className="mail-unlock-err">! {err}</div>}
        </div>

        <div className="mail-compose-footer">
          <div className="r">
            <button type="button" className="btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn-sm primary" onClick={handleSend} disabled={busy}>
              {busy ? "…" :
                mode === "pgp" ? "▸ ENCRYPT & SEND" :
                (linkResult ? "▸ DONE — close" : "▸ CREATE LINK")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function RecipientKeyPanel({
    recipientTarget,
    recipientArmored,
    recipientMeta,
    manualKeyOverride,
    uploadedKeyName,
    keyStatus,
    fetchKey,
    lookupBusy,
    keyError,
    onManualKeyChange,
    onUploadKey,
    onClearManualKey,
    onUseProtectedLink,
    saveToAddressBook,
    setSaveToAddressBook,
    attachPublicKey,
    setAttachPublicKey,
  }) {
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [paste, setPaste] = useState("");

    useEffect(() => {
      setPaste(manualKeyOverride ? (recipientArmored || "") : "");
      if (manualKeyOverride) setShowKeyInput(true);
    }, [recipientArmored, manualKeyOverride]);

    const getStatusIcon = () => {
      if (lookupBusy) return <span className="mail-key-icon checking">⟳</span>;
      if (manualKeyOverride) return <span className="mail-key-icon ok">✓</span>;
      if (keyStatus === "found" && recipientMeta) return <span className="mail-key-icon ok">✓</span>;
      if (keyStatus === "missing" || keyStatus === "error") return <span className="mail-key-icon warn">!</span>;
      return <span className="mail-key-icon idle">○</span>;
    };

    const getStatusText = () => {
      if (lookupBusy) return `Checking ${recipientTarget || "recipient"}…`;
      if (manualKeyOverride) {
        return uploadedKeyName ? `Using ${uploadedKeyName}` : "Manual key set";
      }
      if (keyStatus === "found" && recipientMeta) {
        const fp = recipientMeta.fingerprint ? ` · ${recipientMeta.fingerprint.slice(-8)}` : "";
        return `Key found (${recipientMeta.source})${fp}`;
      }
      if (keyStatus === "missing") return "No key found";
      if (keyStatus === "needs-single") return "Multiple recipients — use protected link";
      if (keyStatus === "error") return "Lookup unavailable";
      return "Enter recipient";
    };

    const canSend = manualKeyOverride || (keyStatus === "found" && recipientMeta);

    return (
      <div className="mail-encrypt-bar">
        <div className="mail-encrypt-status">
          {getStatusIcon()}
          <span className="mail-encrypt-text">{getStatusText()}</span>
          <div className="mail-encrypt-toggles">
            {!lookupBusy && canSend && (
              <label className="mail-encrypt-toggle-sm" title="Save key to address book on send">
                <input
                  type="checkbox"
                  checked={saveToAddressBook}
                  onChange={(e) => setSaveToAddressBook(e.target.checked)}
                />
                <span>Save</span>
              </label>
            )}
            <label className="mail-encrypt-toggle-sm" title="Attach your public key to the message">
              <input
                type="checkbox"
                checked={!!attachPublicKey}
                onChange={(e) => setAttachPublicKey(!!e.target.checked)}
              />
              <span>Attach key</span>
            </label>
          </div>
          <div className="mail-encrypt-actions">
            {!lookupBusy && (keyStatus === "missing" || keyStatus === "error" || keyStatus === "needs-single") && (
              <button
                type="button"
                className="mail-encrypt-link-btn"
                onClick={onUseProtectedLink}
                title="Switch to password-protected link"
              >
                Link ↗
              </button>
            )}
            {manualKeyOverride && (
              <button type="button" className="mail-encrypt-action" onClick={onClearManualKey} title="Clear manual key">
                ✕
              </button>
            )}
            <button
              type="button"
              className="mail-encrypt-action"
              onClick={fetchKey}
              disabled={lookupBusy}
              title="Re-check for public key"
            >
              ↻
            </button>
            <button
              type="button"
              className={`mail-encrypt-action ${showKeyInput ? "active" : ""}`}
              onClick={() => setShowKeyInput(!showKeyInput)}
              title="Upload or paste public key"
            >
              +
            </button>
          </div>
        </div>

        {showKeyInput && (
          <div className="mail-key-input-area">
            <div className="mail-key-input-row">
              <label className="mail-key-upload-btn">
                <span>Upload .asc</span>
                <input
                  type="file"
                  accept=".asc,.txt,.pub,.key"
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) onUploadKey(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="mail-key-or">or paste below</span>
            </div>
            <textarea
              className="mail-key-paste"
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
              value={paste}
              onChange={(e) => {
                const next = e.target.value;
                setPaste(next);
                onManualKeyChange(next);
              }}
              rows={3}
            />
          </div>
        )}

        {keyError && <div className="mail-encrypt-error">! {keyError}</div>}
      </div>
    );
  }

  function ProtectedLinkPanel({ pwd, setPwd, pwdConfirm, setPwdConfirm, meter, ttlSeconds, setTtlSeconds, maxViews, setMaxViews, notify, setNotify }) {
    return (
      <div className="mail-link-panel">
        <div className="mail-link-panel-h">Protected Link Settings</div>
        <div className="mail-compose-field">
          <span className="label">Password</span>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="≥ 12 chars; share out-of-band" />
        </div>
        <div className="mail-compose-field">
          <span className="label">Confirm</span>
          <input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="confirm password" />
        </div>
        <div className="mail-pwd-meter">
          <div className={`mail-pwd-meter-bar score-${meter.score}`} style={{ width: `${(meter.score / 5) * 100}%` }}></div>
          <span className="mail-pwd-meter-label">strength: {meter.label}</span>
        </div>
        <div className="mail-link-row-grid">
          <label className="mail-compose-field inline">
            <span className="label">Expires in</span>
            <select value={ttlSeconds} onChange={(e) => setTtlSeconds(Number(e.target.value))}>
              {TTL_OPTIONS.map((o) => (<option key={o.v} value={o.v}>{o.label}</option>))}
            </select>
          </label>
          <label className="mail-compose-field inline">
            <span className="label">Max views</span>
            <select value={maxViews} onChange={(e) => setMaxViews(Number(e.target.value))}>
              {MAXVIEWS_OPTIONS.map((o) => (<option key={o.v} value={o.v}>{o.label}</option>))}
            </select>
          </label>
        </div>
        <label className="mail-checkbox-row">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>Email recipient(s) the link automatically</span>
        </label>
      </div>
    );
  }

  window.ElvishMailCompose = ElvishMailCompose;
})();
