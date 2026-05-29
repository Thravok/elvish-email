// ELVISH — admin mail operations and testing
const A = window.adm;
const { useState: useSt, useEffect: useEf, useCallback: useCb, useMemo: useMm } = React;

async function apiJSON(url, opts) {
  const res = await fetch(elvishApiUrl(url), {
    credentials: "include",
    ...(opts || {}),
    headers: {
      "Content-Type": "application/json",
      ...((opts && opts.headers) || {})
    }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || String(res.status));
  return json;
}

async function apiForm(url, formData) {
  const res = await fetch(elvishApiUrl(url), {
    method: "POST",
    credentials: "include",
    body: formData
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || String(res.status));
  return json;
}

function fmtDT(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function fmtBytes(v) {
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

function splitEmail(addr) {
  const raw = String(addr || "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at <= 0 || at === raw.length - 1) return { local: "", domain: "" };
  return { local: raw.slice(0, at), domain: raw.slice(at + 1) };
}

function splitRecipientEmails(raw) {
  return Array.from(new Set(String(raw || "")
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)));
}

function bytesToB64(bytes) {
  if (window.ElvishKeygen && typeof window.ElvishKeygen.bytesToB64 === "function") {
    return window.ElvishKeygen.bytesToB64(bytes);
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function sanitizeAttachmentName(name) {
  const raw = String(name || "").replace(/[\r\n\x00"]/g, "").replace(/[/\\]/g, "_").trim();
  if (!raw) return "attachment.bin";
  return raw.length > 255 ? raw.slice(0, 255) : raw;
}

function sanitizeAttachmentType(type) {
  const raw = String(type || "").trim().toLowerCase();
  return raw && !/[\r\n]/.test(raw) ? raw : "application/octet-stream";
}

async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function buildProtectedLinkCipherPayload({ from, to, subject, body, password, attachments }) {
  if (!window.ElvishKeygen) throw new Error("crypto subsystem not loaded");
  const mimeBytes = await buildMimeMessageBytes({ from, to, subject, body, attachments });
  const msgKeyBytes = window.ElvishKeygen.randomBytes(32);
  const msgKey = await crypto.subtle.importKey("raw", msgKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const msgNonce = window.ElvishKeygen.randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: msgNonce }, msgKey, mimeBytes));
  const payloadCt = new Uint8Array(msgNonce.length + ct.length);
  payloadCt.set(msgNonce, 0);
  payloadCt.set(ct, msgNonce.length);
  const salt = window.ElvishKeygen.randomBytes(16);
  const { kdf, key: kek, params } = await window.ElvishKeygen.deriveKEK(password, salt);
  const wrapped = await window.ElvishKeygen.aesWrap(kek, msgKeyBytes);
  msgKeyBytes.fill(0);
  return {
    kdf,
    kdf_salt_b64: bytesToB64(salt),
    kdf_params_json: JSON.stringify(params || {}),
    wrapped_msg_key_b64: bytesToB64(wrapped),
    body_ciphertext_b64: bytesToB64(payloadCt)
  };
}

async function buildMimeMessageBytes({ from, to, subject, body, attachments }) {
  const lines = [];
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [];
  lines.push(`From: ${from || "anonymous"}`);
  lines.push(`To: ${recipients.join(", ")}`);
  if (subject) lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  if (!attachments || attachments.length === 0) {
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 8bit");
    lines.push("");
    lines.push(body || "");
    return new TextEncoder().encode(lines.join("\r\n"));
  }
  const boundary = `elvish-admin-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("Content-Transfer-Encoding: 8bit");
  lines.push("");
  lines.push(body || "");
  for (const attachment of attachments) {
    const bytes = attachment.bytes || await readFileBytes(attachment.file);
    const name = sanitizeAttachmentName(attachment.file_name || (attachment.file && attachment.file.name));
    const contentType = sanitizeAttachmentType(attachment.content_type || (attachment.file && attachment.file.type));
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${contentType}; name="${name}"`);
    lines.push(`Content-Disposition: attachment; filename="${name}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    const b64 = bytesToB64(bytes);
    for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  }
  lines.push(`--${boundary}--`);
  lines.push("");
  return new TextEncoder().encode(lines.join("\r\n"));
}

function validateSystemMailPayload(payload, selectedUsers) {
  if (!String(payload.from_addr || "").trim()) return "Choose a verified sender domain before previewing.";
  if (!String(payload.subject || "").trim()) return "Enter a subject before previewing.";
  if (!String(payload.body_text || "").trim()) return "Enter a message body before previewing.";
  if (payload.audience_kind === "selected" && (!Array.isArray(selectedUsers) || selectedUsers.length === 0)) {
    return "Select at least one user recipient before previewing.";
  }
  return "";
}

function StatusPill({ tone, children }) {
  return <span className={"status-pill" + (tone ? " " + tone : "")}>{children}</span>;
}

function JsonBlock({ value }) {
  if (!value) return null;
  return <pre className="test-output">{JSON.stringify(value, null, 2)}</pre>;
}

function relativeDNSName(name, domain) {
  const fqdn = String(name || "").trim().toLowerCase().replace(/\.$/, "");
  const base = String(domain || "").trim().toLowerCase().replace(/\.$/, "");
  if (!fqdn || !base) return fqdn || "—";
  if (fqdn === base) return "@";
  const suffix = "." + base;
  return fqdn.endsWith(suffix) ? (fqdn.slice(0, -suffix.length) || "@") : fqdn;
}

function buildReadinessDNSGuide(readiness) {
  const delivery = readiness && readiness.delivery;
  const domain = String((delivery && delivery.domain) || "").trim().toLowerCase();
  if (!domain) return [];
  const records = [];
  if (!delivery.mx || !delivery.mx.ok) {
    records.push({
      id: "mx",
      label: "MX",
      type: "MX",
      host: "@",
      value: domain,
      ttl: "Auto",
      extra: "Priority 10",
      note: `Point this at the hostname receiving inbound SMTP for ${domain}. If you use a dedicated mail host such as mx.${domain}, publish that target instead and make sure it has A/AAAA records.`
    });
  }
  if (!delivery.spf || !delivery.spf.ok) {
    records.push({
      id: "spf",
      label: "SPF",
      type: "TXT",
      host: "@",
      value: "v=spf1 mx -all",
      ttl: "Auto",
      note: "This is the usual minimal self-hosted SPF record. Start with ~all instead of -all if you want a softer rollout."
    });
  }
  if (!delivery.dkim || !delivery.dkim.ok) {
    const dkimName = String((delivery.dkim && delivery.dkim.name) || (delivery.dkim_dns_name || "")).trim();
    const dkimValue = String((delivery.dkim && delivery.dkim.expected) || "").trim();
    if (dkimName && dkimValue) {
      records.push({
        id: "dkim",
        label: "DKIM",
        type: "TXT",
        host: relativeDNSName(dkimName, domain),
        fqdn: dkimName,
        value: dkimValue,
        ttl: "Auto",
        note: "Publish the exact DKIM TXT value generated by the active signer."
      });
    }
  }
  if (!delivery.dmarc || !delivery.dmarc.ok) {
    records.push({
      id: "dmarc",
      label: "DMARC",
      type: "TXT",
      host: "_dmarc",
      fqdn: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=s; aspf=s`,
      ttl: "Auto",
      note: "Start with p=none while testing. After SPF and DKIM pass reliably, move to quarantine or reject."
    });
  }
  return records;
}

function userAccountStatusLabel(u) {
  if (u && u.scheduled_delete_at) return "Scheduled delete";
  if (u && u.disabled) return "Disabled";
  return "Active";
}

function UserDetailModal({ user, currentUserId, onClose, onDisable, onEnable, onToggleAdmin, onDelete, busy }) {
  const [detailUser, setDetailUser] = useSt(user);
  const [loadErr, setLoadErr] = useSt("");
  useEf(() => {
    if (!user) {
      setDetailUser(null);
      setLoadErr("");
      return;
    }
    setDetailUser(user);
    setLoadErr("");
    let cancelled = false;
    (async () => {
      try {
        const d = await apiJSON(`/api/admin/users/${encodeURIComponent(user.id)}?expand=mail,auth`);
        if (!cancelled) setDetailUser((prev) => ({ ...prev, ...d }));
      } catch (e) {
        if (!cancelled) setLoadErr(String(e.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [user && user.id]);
  if (!user) return null;
  const u = detailUser || user;
  const isSelf = currentUserId && u.id === currentUserId;
  const statusLabel = userAccountStatusLabel(u);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>User Details</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body mail-detail-grid">
          {loadErr && <div className="f-err" style={{ gridColumn: "1 / -1" }}>{loadErr}</div>}
          <div className="row"><span className="dim">ID</span><span>{u.id}</span></div>
          <div className="row"><span className="dim">Email</span><span>{u.email}</span></div>
          <div className="row"><span className="dim">Name</span><span>{u.name || "—"}</span></div>
          <div className="row"><span className="dim">Status</span><span><span className={"user-status-badge user-status-" + statusLabel.toLowerCase().replace(/\s+/g, "-")}>{statusLabel}</span></span></div>
          <div className="row"><span className="dim">Auth</span><span>{u.auth_method || "—"}</span></div>
          <div className="row"><span className="dim">Admin</span><span>{u.is_admin ? "Yes" : "No"}</span></div>
          <div className="row"><span className="dim">MFA</span><span>{u.mfa_enabled === true ? "Enabled" : u.mfa_enabled === false ? "Off" : "—"}</span></div>
          <div className="row"><span className="dim">Created</span><span>{fmtDT(u.created_at)}</span></div>
          {u.last_activity_at && (
            <div className="row"><span className="dim">Last activity</span><span>{fmtDT(u.last_activity_at)}</span></div>
          )}
          {u.scheduled_delete_at && (
            <div className="row"><span className="dim">Scheduled delete</span><span>{fmtDT(u.scheduled_delete_at)}</span></div>
          )}
          {u.scheduled_delete_reason && (
            <div className="row"><span className="dim">Delete reason</span><span>{u.scheduled_delete_reason}</span></div>
          )}
          {u.identity_count != null && (
            <div className="row"><span className="dim">Active identities</span><span>{u.identity_count}</span></div>
          )}
          {u.owned_domain_count != null && (
            <div className="row"><span className="dim">Owned mail domains</span><span>{u.owned_domain_count}</span></div>
          )}
          {u.shared_domain_allowlist_count != null && (
            <div className="row"><span className="dim">Shared-domain allowlists</span><span>{u.shared_domain_allowlist_count}</span></div>
          )}
        </div>
        <div className="modal-foot" style={{ flexWrap: "wrap", gap: 8 }}>
          {u.disabled && !isSelf && (
            <button className="btn-sm primary" onClick={onEnable} disabled={busy}>Enable</button>
          )}
          {!u.disabled && !isSelf && (
            <button className="btn-sm warn" onClick={onDisable} disabled={busy}>Disable</button>
          )}
          {!isSelf && (
            <button className="btn-sm" onClick={onToggleAdmin} disabled={busy}>
              {u.is_admin ? "Revoke admin" : "Grant admin"}
            </button>
          )}
          {!isSelf && (
            <button className="btn-sm danger" onClick={onDelete} disabled={busy}>Delete</button>
          )}
          {isSelf && <span className="dim" style={{ fontSize: 11 }}>You cannot modify your own account here.</span>}
        </div>
      </div>
    </div>
  );
}

function DomainDetailModal({ domain, onClose, onVerify, onDelete, busy, onSharingSaved }) {
  const [detail, setDetail] = useSt(null);
  const [loadErr, setLoadErr] = useSt("");
  const [shareMode, setShareMode] = useSt("owner_only");
  const [allowlist, setAllowlist] = useSt([]);
  const [userQuery, setUserQuery] = useSt("");
  const [userHits, setUserHits] = useSt([]);
  const [shareBusy, setShareBusy] = useSt(false);
  const [shareErr, setShareErr] = useSt("");
  const [shareOk, setShareOk] = useSt("");

  useEf(() => {
    if (!domain) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadErr("");
    (async () => {
      try {
        const d = await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}`);
        if (cancelled) return;
        setDetail(d);
        setShareMode(String(d.share_mode || "owner_only"));
        setAllowlist(Array.isArray(d.allowlist) ? d.allowlist.map((x) => ({ user_id: x.user_id, email: x.email })) : []);
      } catch (e) {
        if (!cancelled) setLoadErr(String(e.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [domain && domain.domain]);

  useEf(() => {
    if (!userQuery.trim()) {
      setUserHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await apiJSON(`/api/admin/users?q=${encodeURIComponent(userQuery.trim())}&limit=12`);
        if (cancelled) return;
        setUserHits(data.users || []);
      } catch (_) {
        if (!cancelled) setUserHits([]);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userQuery]);

  if (!domain) return null;

  const addAllow = (u) => {
    if (!u || !u.id) return;
    if (allowlist.some((a) => a.user_id === u.id)) return;
    setAllowlist((prev) => [...prev, { user_id: u.id, email: u.email }]);
    setUserQuery("");
    setUserHits([]);
  };

  const removeAllow = (id) => {
    setAllowlist((prev) => prev.filter((a) => a.user_id !== id));
  };

  const saveSharing = async () => {
    setShareBusy(true);
    setShareErr("");
    setShareOk("");
    try {
      const body = {
        share_mode: shareMode,
        allowlist_user_ids: shareMode === "allowlist" ? allowlist.map((a) => a.user_id) : []
      };
      await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}/sharing`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setShareOk("Sharing saved.");
      try {
        const d = await apiJSON(`/api/admin/domains/${encodeURIComponent(domain.domain)}`);
        setDetail(d);
        setShareMode(String(d.share_mode || "owner_only"));
        setAllowlist(Array.isArray(d.allowlist) ? d.allowlist.map((x) => ({ user_id: x.user_id, email: x.email })) : []);
      } catch (_) { /* list row still updated via onSharingSaved */ }
      if (typeof onSharingSaved === "function") onSharingSaved();
    } catch (e) {
      setShareErr(String(e.message || e));
    }
    setShareBusy(false);
  };

  const d = detail || domain;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h3>Domain Details</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body mail-detail-grid">
          {loadErr && <div className="f-err" style={{ gridColumn: "1 / -1" }}>{loadErr}</div>}
          <div className="row"><span className="dim">Domain</span><span>{d.domain}</span></div>
          <div className="row"><span className="dim">Owner</span><span>{d.owner_email || d.owner_user_id || "—"}</span></div>
          <div className="row"><span className="dim">Status</span><span>{d.status || "—"}</span></div>
          <div className="row"><span className="dim">Share mode</span><span>{d.share_mode || "owner_only"}</span></div>
          <div className="row"><span className="dim">TXT host</span><span>{d.verification_txt_host || "—"}</span></div>
          <div className="row"><span className="dim">TXT value</span><span>{d.verification_txt_value || "—"}</span></div>
          <div className="row"><span className="dim">Catch-all FP</span><span>{d.catchall_identity_fp || "—"}</span></div>
          <div className="row"><span className="dim">MX</span><span>{d.mx_verified ? "Verified" : "Missing"}</span></div>
          <div className="row"><span className="dim">SPF</span><span>{d.spf_verified ? "Verified" : "Missing"}</span></div>
          <div className="row"><span className="dim">DKIM</span><span>{d.dkim_verified ? "Verified" : "Missing"}</span></div>
          <div className="row"><span className="dim">DMARC</span><span>{d.dmarc_verified ? "Verified" : "Missing"}</span></div>
          <div className="row"><span className="dim">Created</span><span>{fmtDT(d.created_at)}</span></div>
          <div className="f-help" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            Sharing controls who may create mailbox identities @ this domain once it is active with MX verified. DNS, DKIM files, and catch-all routing stay with the listed owner; shared users do not receive owner-only catch-all behavior for addresses they did not register.
          </div>
          <div style={{ gridColumn: "1 / -1", marginTop: 12 }}>
            <label className="dim" style={{ display: "block", marginBottom: 6 }}>Identity sharing</label>
            <select className="inp" value={shareMode} onChange={(e) => setShareMode(e.target.value)} style={{ width: "100%", maxWidth: 360 }}>
              <option value="owner_only">Owner only (default)</option>
              <option value="all_verified_users">All signed-in users</option>
              <option value="allowlist">Allowlisted users only</option>
            </select>
          </div>
          {shareMode === "allowlist" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="f-help" style={{ marginBottom: 8 }}>Search users by email and add to the allowlist.</div>
              <div className="search-bar" style={{ marginBottom: 8 }}>
                <input className="inp" placeholder="Search users…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
              </div>
              {userHits.length > 0 && (
                <div style={{ border: "1px solid var(--line)", maxHeight: 140, overflow: "auto", marginBottom: 8 }}>
                  {userHits.map((u) => (
                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--line)" }}>
                      <span>{u.email}</span>
                      <button type="button" className="btn-sm" onClick={() => addAllow(u)}>Add</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                {allowlist.length === 0 && <span className="dim">No users allowlisted yet.</span>}
                {allowlist.map((a) => (
                  <div key={a.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span>{a.email}</span>
                    <button type="button" className="btn-sm danger" onClick={() => removeAllow(a.user_id)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {shareErr && <div className="f-err" style={{ gridColumn: "1 / -1" }}>{shareErr}</div>}
          {shareOk && <div className="f-ok" style={{ gridColumn: "1 / -1" }}>{shareOk}</div>}
          <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            <button type="button" className="btn-sm primary" onClick={saveSharing} disabled={shareBusy || !!loadErr}>
              {shareBusy ? "Saving…" : "Save sharing"}
            </button>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-sm" onClick={onVerify} disabled={busy}>Verify DNS</button>
          <button className="btn-sm danger" onClick={onDelete} disabled={busy}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const ADMIN_USER_PAGE = 20;
const ADMIN_DOMAIN_PAGE = 20;

function SecUsers() {
  const [users, setUsers] = useSt([]);
  const [total, setTotal] = useSt(0);
  const [page, setPage] = useSt(1);
  const [searchDraft, setSearchDraft] = useSt("");
  const [query, setQuery] = useSt("");
  const [statusFilter, setStatusFilter] = useSt("all");
  const [adminFilter, setAdminFilter] = useSt("all");
  const [loading, setLoading] = useSt(false);
  const [loadError, setLoadError] = useSt("");
  const [currentUserId, setCurrentUserId] = useSt(null);
  const [selected, setSelected] = useSt(null);
  const [busy, setBusy] = useSt(false);
  const [confirmAction, setConfirmAction] = useSt(null);
  const [actionError, setActionError] = useSt("");
  const [actionOk, setActionOk] = useSt("");

  useEf(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await apiJSON("/api/auth/me");
        const me = j && j.user;
        if (!cancelled && me && me.id) setCurrentUserId(me.id);
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEf(() => {
    const t = setTimeout(() => {
      setQuery(searchDraft.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const load = useCb(async () => {
    setLoading(true);
    setLoadError("");
    try {
      let url = `/api/admin/users?page=${page}&limit=${ADMIN_USER_PAGE}`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      if (statusFilter && statusFilter !== "all") url += `&status=${encodeURIComponent(statusFilter)}`;
      if (adminFilter === "admin") url += "&admin=true";
      if (adminFilter === "nonadmin") url += "&admin=false";
      const data = await apiJSON(url);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      setLoadError(String(e.message || e));
      setUsers([]);
    }
    setLoading(false);
  }, [page, query, statusFilter, adminFilter]);

  const userPageStart = (page - 1) * ADMIN_USER_PAGE;
  const userHasNext = userPageStart + users.length < total;

  useEf(() => { load(); }, [load]);

  const closeModal = () => {
    setSelected(null);
    setBusy(false);
    load();
  };

  const confirmTitles = {
    disable: "Disable User",
    enable: "Enable User",
    delete: "Delete User",
    admin_grant: "Grant Admin",
    admin_revoke: "Revoke Admin",
  };

  return (
    <div data-testid="admin-users-panel">
      <A.H num="02" title="USERS" sub={`${total} accounts · moderation · directory`} />
      <div className="adm-explain">
        Inspect and moderate platform accounts. Disable blocks sign-in; delete purges mail data and storage for the user. System mail can target users from this directory.
      </div>
      {actionOk && <div className="f-ok" style={{ marginBottom: 12 }}>{actionOk}</div>}
      <A.Card title="USER DIRECTORY" right={loading ? "loading…" : `${users.length} on page · ${total} total`}>
        <div className="search-bar" style={{ marginBottom: 10 }}>
          <input
            type="text"
            className="inp"
            placeholder="Search email or name…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <div className="filters" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All status" },
            { id: "active", label: "Active" },
            { id: "disabled", label: "Disabled" },
          ].map((f) => (
            <button key={f.id} type="button" className={"btn-sm" + (statusFilter === f.id ? " active" : "")} onClick={() => { setStatusFilter(f.id); setPage(1); }}>
              {f.label}
            </button>
          ))}
          <span className="dim" style={{ margin: "0 6px" }}>|</span>
          {[
            { id: "all", label: "All roles" },
            { id: "admin", label: "Admins" },
            { id: "nonadmin", label: "Non-admin" },
          ].map((f) => (
            <button key={f.id} type="button" className={"btn-sm" + (adminFilter === f.id ? " active" : "")} onClick={() => { setAdminFilter(f.id); setPage(1); }}>
              {f.label}
            </button>
          ))}
        </div>
        {loadError && <div className="f-err" style={{ marginBottom: 10 }}>{loadError}</div>}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
              <th>Auth</th>
              <th>Admin</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="dim">Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan="7" className="dim">No users found</td></tr>}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td><span className={"user-status-badge user-status-" + userAccountStatusLabel(u).toLowerCase().replace(/\s+/g, "-")}>{userAccountStatusLabel(u)}</span></td>
                <td className="dim">{u.auth_method || "—"}</td>
                <td>{u.is_admin ? "Yes" : "—"}</td>
                <td className="dim">{fmtDT(u.created_at)}</td>
                <td><button className="btn-sm" onClick={() => setSelected(u)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <button className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="dim">Page {page}{total > 0 ? ` · ${userPageStart + 1}–${userPageStart + users.length} of ${total}` : ""}</span>
          <button className="btn-sm" disabled={!userHasNext} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </A.Card>
      <UserDetailModal
        user={selected}
        currentUserId={currentUserId}
        busy={busy}
        onClose={closeModal}
        onDisable={() => { if (selected) setConfirmAction({ type: "disable", user: selected }); }}
        onEnable={() => { if (selected) setConfirmAction({ type: "enable", user: selected }); }}
        onToggleAdmin={() => {
          if (selected) {
            setConfirmAction({ type: selected.is_admin ? "admin_revoke" : "admin_grant", user: selected });
          }
        }}
        onDelete={() => { if (selected) setConfirmAction({ type: "delete", user: selected }); }}
      />

      {confirmAction && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) { setConfirmAction(null); setActionError(""); } }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 440, width: "90%", position: "relative" }}>
            <div style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {confirmTitles[confirmAction.type] || "Confirm"}
              </span>
              <button type="button" className="btn-close" onClick={() => { setConfirmAction(null); setActionError(""); }} disabled={busy}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              {actionError && <div style={{ padding: "10px 12px", marginBottom: 14, border: "1px solid rgba(255,80,80,0.5)", color: "#ff6b6b", fontSize: 12 }}>{actionError}</div>}
              <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
                {confirmAction.type === "disable" && `Disable "${confirmAction.user.email}"? They cannot sign in until re-enabled.`}
                {confirmAction.type === "enable" && `Re-enable "${confirmAction.user.email}"? SRP accounts restore immediately; legacy accounts may need a password reset.`}
                {confirmAction.type === "delete" && `Permanently delete "${confirmAction.user.email}" and purge associated mail data? This cannot be undone.`}
                {confirmAction.type === "admin_grant" && `Grant operator (admin) access to "${confirmAction.user.email}"?`}
                {confirmAction.type === "admin_revoke" && `Revoke operator access from "${confirmAction.user.email}"?`}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-sm" onClick={() => { setConfirmAction(null); setActionError(""); }} disabled={busy}>Cancel</button>
                <button
                  type="button"
                  className={"btn-sm" + (confirmAction.type === "delete" || confirmAction.type === "admin_revoke" ? " danger" : confirmAction.type === "enable" ? " primary" : " warn")}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setActionError("");
                    setActionOk("");
                    try {
                      const id = confirmAction.user.id;
                      if (confirmAction.type === "disable") {
                        await apiJSON(`/api/admin/users/${id}/disable`, { method: "POST" });
                        setActionOk(`Disabled ${confirmAction.user.email}.`);
                      } else if (confirmAction.type === "enable") {
                        await apiJSON(`/api/admin/users/${id}/enable`, { method: "POST" });
                        setActionOk(`Enabled ${confirmAction.user.email}.`);
                      } else if (confirmAction.type === "delete") {
                        await apiJSON(`/api/admin/users/${id}`, { method: "DELETE" });
                        setActionOk(`Deleted ${confirmAction.user.email}.`);
                      } else if (confirmAction.type === "admin_grant" || confirmAction.type === "admin_revoke") {
                        await apiJSON(`/api/admin/users/${id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ is_admin: confirmAction.type === "admin_grant" }),
                        });
                        setActionOk(confirmAction.type === "admin_grant" ? `Granted admin to ${confirmAction.user.email}.` : `Revoked admin from ${confirmAction.user.email}.`);
                      }
                      setConfirmAction(null);
                      closeModal();
                    } catch (e) {
                      setActionError(String(e.message || e));
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecOutbox() {
  const [stats, setStats] = useSt({ pending: 0, sending: 0, sent: 0, failed: 0 });
  const [items, setItems] = useSt([]);
  const [page, setPage] = useSt(1);
  const [status, setStatus] = useSt("");
  const [source, setSource] = useSt("");
  const [loading, setLoading] = useSt(false);

  const load = useCb(async () => {
    setLoading(true);
    try {
      const statsData = await apiJSON("/api/admin/outbox/stats");
      setStats(statsData || {});
      const url = `/api/admin/outbox?page=${page}&limit=20${status ? `&status=${encodeURIComponent(status)}` : ""}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
      const listData = await apiJSON(url);
      setItems(listData.items || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [page, status, source]);

  useEf(() => { load(); }, [load]);

  return (
    <div data-testid="admin-outbox-panel">
      <A.H num="03" title="OUTBOX" sub="queue status · retries · admin/system tagging" />
      <div className="adm-explain">
        Admin and system mail now reuse the same secure outbox and worker path as the rest of the platform. The table below stays metadata-only and never exposes stored message bodies.
      </div>
      <div className="stats-row">
        <div className="stat"><span className="dim">Pending</span><span>{stats.pending || 0}</span></div>
        <div className="stat"><span className="dim">Sending</span><span>{stats.sending || 0}</span></div>
        <div className="stat"><span className="dim">Sent</span><span className="ok">{stats.sent || 0}</span></div>
        <div className="stat"><span className="dim">Failed</span><span className="warn">{stats.failed || 0}</span></div>
      </div>
      <A.Card title="FILTERS" right={<button className="btn-sm" onClick={load}>Refresh</button>}>
        <div className="filters">
          {["", "pending", "sending", "sent", "failed"].map((v) => (
            <button key={v || "all"} className={"btn-sm" + (status === v ? " active" : "")} onClick={() => { setStatus(v); setPage(1); }}>
              {v || "ALL"}
            </button>
          ))}
        </div>
        <div className="filters" style={{ marginTop: 8 }}>
          {[
            ["", "ALL SOURCES"],
            ["admin_system", "SYSTEM MAIL"],
            ["admin_test", "TEST PROBES"],
            ["protected_link_notice", "PROTECTED LINK"],
            ["user_mail", "USER MAIL"]
          ].map(([value, label], idx) => (
            <button
              key={label + idx}
              className={"btn-sm" + (source === value ? " active" : "")}
              onClick={() => { setSource(value); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>
      </A.Card>
      <A.Card title="OUTBOX ROWS" right={loading ? "loading…" : `${items.length} visible`}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Source</th>
              <th>Kind</th>
              <th>Recipient</th>
              <th>Run</th>
              <th>Created</th>
              <th>Error</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="dim">Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan="8" className="dim">No outbox items</td></tr>}
            {items.map((it) => (
              <tr key={it.ID}>
                <td><StatusPill tone={it.Status === "failed" ? "warn" : it.Status === "sent" ? "ok" : ""}>{it.Status}</StatusPill></td>
                <td>{it.Source || "user_mail"}</td>
                <td>{it.Kind || "pgp"}</td>
                <td>{it.RecipientSummary || "—"}</td>
                <td className="mono tiny">{it.AdminRunID && it.AdminRunID !== "00000000-0000-0000-0000-000000000000" ? it.AdminRunID.slice(0, 8) : "—"}</td>
                <td className="dim">{fmtDT(it.CreatedAt)}</td>
                <td className="dim">{it.LastError ? String(it.LastError).slice(0, 64) : "—"}</td>
                <td>
                  {it.Status === "failed" && <button className="btn-sm" onClick={async () => { await apiJSON(`/api/admin/outbox/${it.ID}/retry`, { method: "POST" }); load(); }}>Retry</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <button className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="dim">Page {page}</span>
          <button className="btn-sm" disabled={items.length < 20} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </A.Card>
    </div>
  );
}

function SecDomains() {
  const [domains, setDomains] = useSt([]);
  const [total, setTotal] = useSt(0);
  const [page, setPage] = useSt(1);
  const [loading, setLoading] = useSt(false);
  const [busy, setBusy] = useSt("");
  const [selected, setSelected] = useSt(null);
  const [msg, setMsg] = useSt("");
  const [err, setErr] = useSt("");
  const [addResult, setAddResult] = useSt(null);
  const [form, setForm] = useSt({ domain: "", owner_email: "" });
  const [confirmDelete, setConfirmDelete] = useSt(null);

  const load = useCb(async () => {
    setLoading(true);
    try {
      const data = await apiJSON(`/api/admin/domains?page=${page}&limit=${ADMIN_DOMAIN_PAGE}`);
      const next = data.domains || [];
      setDomains(next);
      setTotal(data.total || 0);
      setSelected((curr) => (curr ? (next.find((d) => d.domain === curr.domain) || null) : null));
    } catch (e) {
      setErr(String(e.message || e));
    }
    setLoading(false);
  }, [page]);

  const domainPageStart = (page - 1) * ADMIN_DOMAIN_PAGE;
  const domainHasNext = domainPageStart + domains.length < total;

  useEf(() => { load(); }, [load]);

  const registerDomain = async (e) => {
    e.preventDefault();
    setBusy("add");
    setErr("");
    setMsg("");
    setAddResult(null);
    try {
      const res = await apiJSON("/api/admin/domains", {
        method: "POST",
        body: JSON.stringify({
          domain: form.domain,
          owner_email: form.owner_email
        })
      });
      setMsg(`Registered ${res.domain} for ${res.owner_email}. Publish the TXT record, then run verification.`);
      setAddResult(res);
      setForm({ domain: "", owner_email: "" });
      await load();
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
    setBusy("");
  };

  const verifyDomain = async (domainName) => {
    setBusy(`verify:${domainName}`);
    setErr("");
    setMsg("");
    try {
      const res = await apiJSON(`/api/admin/domains/${encodeURIComponent(domainName)}/verify`, { method: "POST" });
      const checks = [
        `Ownership ${res.ownership_verified ? "ok" : "missing"}`,
        `MX ${res.mx_verified ? "ok" : "missing"}`,
        `SPF ${res.spf_verified ? "ok" : "missing"}`,
        `DKIM ${res.dkim_verified ? "ok" : "missing"}`,
        `DMARC ${res.dmarc_verified ? "ok" : "missing"}`
      ];
      const suffix = Array.isArray(res.issues) && res.issues.length ? ` · ${res.issues.join(" | ")}` : "";
      setMsg(`Verified ${domainName}: ${checks.join(" · ")}${suffix}`);
      await load();
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
    setBusy("");
  };

  const deleteDomain = (domainName) => {
    setConfirmDelete(domainName);
  };

  const executeDeleteDomain = async () => {
    if (!confirmDelete) return;
    const domainName = confirmDelete;
    setBusy(`delete:${domainName}`);
    setErr("");
    setMsg("");
    try {
      await apiJSON(`/api/admin/domains/${encodeURIComponent(domainName)}`, { method: "DELETE" });
      setMsg(`Deleted ${domainName}.`);
      setSelected((curr) => (curr && curr.domain === domainName ? null : curr));
      setConfirmDelete(null);
      await load();
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
    setBusy("");
  };

  return (
    <div data-testid="admin-domains-panel">
      <A.H num="04" title="DOMAINS" sub={`${total} custom domains · verification state`} />
      <div className="adm-explain">
        Admin system mail is restricted to verified sender domains. SPF, DKIM, and DMARC verification state shown here directly affects which domains are eligible.
      </div>
      {err && <div className="f-err">{err}</div>}
      {msg && <div className="f-ok">{msg}</div>}
      <A.Card title="REGISTER DOMAIN" right="admin-managed">
        <form className="search-bar" onSubmit={registerDomain}>
          <input
            className="inp"
            placeholder="Owner email"
            value={form.owner_email}
            onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))}
          />
          <input
            className="inp"
            placeholder="example.com"
            value={form.domain}
            onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
          />
          <button className="btn-sm primary" type="submit" disabled={busy === "add"}>
            {busy === "add" ? "Adding…" : "Add Domain"}
          </button>
        </form>
        <div className="f-help">Register a custom domain against an existing user, then publish the TXT record and run verification from this panel.</div>
        <JsonBlock value={addResult && addResult.dns_config ? addResult.dns_config : null} />
      </A.Card>
      <A.Card title="OWNED DOMAINS" right={loading ? "loading…" : `${domains.length} on page · ${total} total`}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Sharing</th>
              <th>Allowlist</th>
              <th>MX</th>
              <th>SPF</th>
              <th>DKIM</th>
              <th>DMARC</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="11" className="dim">Loading…</td></tr>}
            {!loading && domains.length === 0 && <tr><td colSpan="11" className="dim">No custom domains</td></tr>}
            {domains.map((d) => (
              <tr key={d.domain}>
                <td>{d.domain}</td>
                <td className="dim">{d.owner_email || "—"}</td>
                <td>{d.status}</td>
                <td className="dim tiny">{d.share_mode || "owner_only"}</td>
                <td className="dim">{d.allowlist_count != null ? d.allowlist_count : "—"}</td>
                <td className={d.mx_verified ? "ok" : "dim"}>{d.mx_verified ? "✓" : "—"}</td>
                <td className={d.spf_verified ? "ok" : "dim"}>{d.spf_verified ? "✓" : "—"}</td>
                <td className={d.dkim_verified ? "ok" : "dim"}>{d.dkim_verified ? "✓" : "—"}</td>
                <td className={d.dmarc_verified ? "ok" : "dim"}>{d.dmarc_verified ? "✓" : "—"}</td>
                <td className="dim">{fmtDT(d.created_at)}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-sm" onClick={() => setSelected(d)}>View</button>
                    <button className="btn-sm" onClick={() => verifyDomain(d.domain)} disabled={busy === `verify:${d.domain}`}>Verify</button>
                    <button className="btn-sm danger" onClick={() => deleteDomain(d.domain)} disabled={busy === `delete:${d.domain}`}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <button className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="dim">Page {page}{total > 0 ? ` · ${domainPageStart + 1}–${domainPageStart + domains.length} of ${total}` : ""}</span>
          <button className="btn-sm" disabled={!domainHasNext} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </A.Card>
      <DomainDetailModal
        domain={selected}
        busy={!!busy}
        onClose={() => setSelected(null)}
        onVerify={() => selected && verifyDomain(selected.domain)}
        onDelete={() => selected && deleteDomain(selected.domain)}
        onSharingSaved={load}
      />

      {confirmDelete && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirmDelete(null); }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 420, width: "90%", position: "relative" }}>
            <div style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Delete Domain</span>
              <button type="button" className="btn-close" onClick={() => setConfirmDelete(null)} disabled={!!busy}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
                Are you sure you want to delete domain "{confirmDelete}"? This action cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-sm" onClick={() => setConfirmDelete(null)} disabled={!!busy}>Cancel</button>
                <button type="button" className="btn-sm danger" disabled={!!busy} onClick={executeDeleteDomain}>
                  {busy ? "Deleting…" : "Delete Domain"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecMailTest() {
  const M = window.VModals;
  const [health, setHealth] = useSt(null);
  const [readiness, setReadiness] = useSt(null);
  const [authPosture, setAuthPosture] = useSt(null);
  const [privacyPosture, setPrivacyPosture] = useSt(null);
  const [keyMaterial, setKeyMaterial] = useSt(null);
  const [mailConfig, setMailConfig] = useSt(null);
  const [echoResult, setEchoResult] = useSt(null);
  const [keyserverResult, setKeyserverResult] = useSt(null);
  const [wrapResult, setWrapResult] = useSt(null);
  const [testSearchQuery, setTestSearchQuery] = useSt("");
  const [testSearchResults, setTestSearchResults] = useSt([]);
  const [testSearching, setTestSearching] = useSt(false);
  const [selectedTestUsers, setSelectedTestUsers] = useSt([]);
  const [testAttachments, setTestAttachments] = useSt([]);
  const [testPreview, setTestPreview] = useSt(null);
  const [testResult, setTestResult] = useSt(null);
  const [testErr, setTestErr] = useSt("");
  const [testMsg, setTestMsg] = useSt("");
  const [testSending, setTestSending] = useSt(false);
  const [keyMsg, setKeyMsg] = useSt("");
  const [keyAlert, setKeyAlert] = useSt(null);
  const [form, setForm] = useSt({
    recipient_email: "",
    from_addr: "",
    key_email: "",
    wrap_kdf: "argon2id",
    dkim_pem: "",
    dkim_selector: "mail",
    dkim_domain: "",
    test_local_part: "announcements",
    test_domain: "",
    test_send_mode: "plaintext",
    test_subject: "Elvish admin mail test",
    test_body_text: "This is a test message queued from the admin panel.",
    test_external_emails: "",
    test_notify_recipients: true,
    test_ttl_days: 7,
    test_max_views: 3,
    test_password: "",
    test_password_confirm: ""
  });
  const [confirmKeyAction, setConfirmKeyAction] = useSt(null);
  const [keyActionBusy, setKeyActionBusy] = useSt(false);
  const readinessDNSGuide = useMm(() => buildReadinessDNSGuide(readiness), [readiness]);

  const closeKeyAlert = useCb(() => setKeyAlert(null), []);
  const showKeyAlert = useCb((fallbackTitle, err) => {
    const raw = String((err && err.message) || err || "Unexpected error").trim();
    const splitAt = raw.indexOf(": ");
    const title = splitAt > 0 && splitAt < 72 ? raw.slice(0, splitAt) : fallbackTitle;
    const body = splitAt > 0 && splitAt < 72 ? raw.slice(splitAt + 2) : raw;
    setKeyAlert({ kind: "err", title, body });
  }, []);

  const runHealth = async () => {
    setHealth({ loading: true });
    try {
      setHealth(await apiJSON("/api/admin/test/health"));
    } catch (e) {
      setHealth({ error: String(e.message || e) });
    }
  };
  const runReadiness = async () => {
    setReadiness({ loading: true });
    try {
      setReadiness(await apiJSON("/api/admin/test/readiness"));
    } catch (e) {
      setReadiness({ error: String(e.message || e) });
    }
  };
  const runAuthPosture = async () => {
    setAuthPosture({ loading: true });
    try {
      setAuthPosture(await apiJSON("/api/admin/test/auth-posture"));
    } catch (e) {
      setAuthPosture({ error: String(e.message || e) });
    }
  };
  const runPrivacyPosture = async () => {
    setPrivacyPosture({ loading: true });
    try {
      setPrivacyPosture(await apiJSON("/api/admin/test/privacy-posture"));
    } catch (e) {
      setPrivacyPosture({ error: String(e.message || e) });
    }
  };
  const loadKeyMaterial = async () => {
    setKeyMaterial({ loading: true });
    try {
      const data = await apiJSON("/api/admin/test/key-material");
      setKeyMaterial(data);
      setForm((f) => ({
        ...f,
        dkim_selector: (data && data.dkim && data.dkim.selector) || f.dkim_selector || "mail",
        dkim_domain: (data && data.dkim && data.dkim.domain) || f.dkim_domain || ""
      }));
    } catch (e) {
      setKeyMaterial({ error: String(e.message || e) });
    }
  };
  const loadMailConfig = async () => {
    try {
      const data = await apiJSON("/api/admin/system-mail");
      setMailConfig(data);
      const preferredFrom = splitEmail(data.default_from_addr || "");
      const fallbackDomain = (data.sender_domains && data.sender_domains[0] && data.sender_domains[0].domain) || "";
      setForm((f) => ({
        ...f,
        test_local_part: f.test_local_part || preferredFrom.local || "announcements",
        test_domain: f.test_domain || preferredFrom.domain || fallbackDomain
      }));
    } catch (e) {
      setTestErr(String(e.message || e));
    }
  };
  const runEcho = async () => {
    setEchoResult({ loading: true });
    try {
      setEchoResult(await apiJSON("/api/admin/test/echo", {
        method: "POST",
        body: JSON.stringify({
          recipient_email: form.recipient_email,
          from_addr: form.from_addr
        })
      }));
    } catch (e) {
      setEchoResult({ error: String(e.message || e) });
    }
  };
  const runKeyserver = async () => {
    setKeyserverResult({ loading: true });
    try {
      setKeyserverResult(await apiJSON("/api/admin/test/keyserver-probe", {
        method: "POST",
        body: JSON.stringify({ email: form.key_email })
      }));
    } catch (e) {
      setKeyserverResult({ error: String(e.message || e) });
    }
  };
  const runWrap = async () => {
    setWrapResult({ loading: true });
    try {
      setWrapResult(await apiJSON("/api/admin/test/wrap-roundtrip", {
        method: "POST",
        body: JSON.stringify({ kdf: form.wrap_kdf })
      }));
    } catch (e) {
      setWrapResult({ error: String(e.message || e) });
    }
  };
  const searchTestUsers = async () => {
    setTestSearching(true);
    try {
      const data = await apiJSON(`/api/admin/users?page=1&limit=10&q=${encodeURIComponent(testSearchQuery)}`);
      const next = (data.users || []).filter((u) => !selectedTestUsers.some((s) => s.id === u.id));
      setTestSearchResults(next);
    } catch (e) {
      setTestErr(String(e.message || e));
    }
    setTestSearching(false);
  };

  useEf(() => {
    runHealth();
    runReadiness();
    runAuthPosture();
    runPrivacyPosture();
    loadKeyMaterial();
    loadMailConfig();
  }, []);

  const dkimSelectorPreview = String(form.dkim_selector || ((keyMaterial && keyMaterial.dkim && keyMaterial.dkim.selector) || "mail")).trim().toLowerCase();
  const dkimDomainPreview = String(form.dkim_domain || ((keyMaterial && keyMaterial.dkim && keyMaterial.dkim.domain) || "")).trim().toLowerCase();
  const dkimDNSPreview = dkimSelectorPreview && dkimDomainPreview ? `${dkimSelectorPreview}._domainkey.${dkimDomainPreview}` : "";
  const senderDomains = (mailConfig && mailConfig.sender_domains) || [];
  const computedTestFromAddr = form.test_domain ? `${String(form.test_local_part || "").trim() || "announcements"}@${form.test_domain}` : "";
  const testRecipientEmails = useMm(() => {
    const emails = [
      ...selectedTestUsers.map((u) => String(u.email || "").trim().toLowerCase()).filter(Boolean),
      ...splitRecipientEmails(form.test_external_emails)
    ];
    return Array.from(new Set(emails));
  }, [selectedTestUsers, form.test_external_emails]);
  const buildAttachmentPayload = useCb(() => (
    testAttachments.map((att) => ({
      upload_id: att.upload_id || "",
      file_name: att.file_name,
      content_type: att.content_type,
      size_bytes: att.size_bytes
    }))
  ), [testAttachments]);
  const buildTestPayload = useCb((extraProtectedLink) => ({
    local_user_ids: selectedTestUsers.map((u) => u.id),
    external_emails: splitRecipientEmails(form.test_external_emails),
    from_addr: computedTestFromAddr,
    subject: String(form.test_subject || "").trim(),
    body_text: String(form.test_body_text || "").trim(),
    send_mode: form.test_send_mode,
    attachments: buildAttachmentPayload(),
    protected_link: {
      notify_recipients: !!form.test_notify_recipients,
      ttl_seconds: Math.max(1, Number(form.test_ttl_days || 7)) * 86400,
      max_views: Math.max(0, Number(form.test_max_views || 0)),
      ...(extraProtectedLink || {})
    }
  }), [selectedTestUsers, form, computedTestFromAddr, buildAttachmentPayload]);
  const validateTestComposer = useCb((forSend) => {
    if (!computedTestFromAddr) return "Choose a verified sender domain before testing mail delivery.";
    if (!String(form.test_subject || "").trim()) return "Enter a subject before previewing or sending.";
    if (!String(form.test_body_text || "").trim()) return "Enter a message body before previewing or sending.";
    if (selectedTestUsers.length === 0 && splitRecipientEmails(form.test_external_emails).length === 0) {
      return "Add at least one recipient before previewing or sending.";
    }
    if (forSend && form.test_send_mode === "protected_link") {
      if (!String(form.test_password || "").trim()) return "Enter a protected-link password before sending.";
      if (String(form.test_password) !== String(form.test_password_confirm)) return "Protected-link passwords do not match.";
    }
    return "";
  }, [computedTestFromAddr, form, selectedTestUsers]);
  const ensurePlaintextUploads = useCb(async () => {
    const next = [...testAttachments];
    for (let i = 0; i < next.length; i += 1) {
      if (next[i].upload_id || !next[i].file) continue;
      next[i] = { ...next[i], uploading: true, error: "" };
      setTestAttachments([...next]);
      const fd = new FormData();
      fd.append("file", next[i].file, next[i].file_name);
      try {
        const uploaded = await apiForm("/api/admin/test/uploads", fd);
        next[i] = {
          ...next[i],
          uploading: false,
          upload_id: uploaded.upload_id,
          file_name: uploaded.file_name,
          content_type: uploaded.content_type,
          size_bytes: uploaded.size_bytes
        };
        setTestAttachments([...next]);
      } catch (e) {
        next[i] = { ...next[i], uploading: false, error: String(e.message || e) };
        setTestAttachments([...next]);
        throw e;
      }
    }
  }, [testAttachments]);
  const runTestPreview = useCb(async () => {
    setTestErr("");
    setTestMsg("");
    setTestResult(null);
    const validationErr = validateTestComposer(false);
    if (validationErr) {
      setTestPreview(null);
      setTestErr(validationErr);
      return;
    }
    try {
      if (form.test_send_mode === "plaintext") await ensurePlaintextUploads();
      setTestPreview(await apiJSON("/api/admin/test/preview", {
        method: "POST",
        body: JSON.stringify(buildTestPayload())
      }));
    } catch (e) {
      setTestPreview(null);
      setTestErr(String(e.message || e));
    }
  }, [validateTestComposer, form.test_send_mode, ensurePlaintextUploads, buildTestPayload]);
  const runTestSend = useCb(async () => {
    setTestErr("");
    setTestMsg("");
    setTestSending(true);
    try {
      const validationErr = validateTestComposer(true);
      if (validationErr) throw new Error(validationErr);
      let payload = buildTestPayload();
      if (form.test_send_mode === "plaintext") {
        await ensurePlaintextUploads();
        payload = buildTestPayload();
      } else {
        const protectedLink = await buildProtectedLinkCipherPayload({
          from: computedTestFromAddr,
          to: testRecipientEmails,
          subject: String(form.test_subject || "").trim(),
          body: String(form.test_body_text || "").trim(),
          password: String(form.test_password || ""),
          attachments: testAttachments
        });
        payload = buildTestPayload(protectedLink);
      }
      const res = await apiJSON("/api/admin/test/send", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setTestResult(res);
      setTestMsg(res.url ? `Protected link ready: ${res.url}` : `Test mail queued for ${res.queued_count || 0} recipient(s).`);
      setTestAttachments((list) => list.map((att) => ({ ...att, upload_id: "" })));
    } catch (e) {
      setTestErr(String(e.message || e));
    } finally {
      setTestSending(false);
    }
  }, [validateTestComposer, buildTestPayload, form, ensurePlaintextUploads, computedTestFromAddr, testRecipientEmails, testAttachments]);

  return (
    <>
    <div data-testid="admin-mail-test-panel">
      <A.H num="05" title="TESTING" sub="deliverability · crypto · bounded probes" />
      <div className="adm-explain">
        These tools are authenticated admin diagnostics. The send-path probe stays inside the normal relay-wrapped outbox flow, key lookups are explicit and rate-limited, and no tool exposes stored message bodies.
      </div>
      {keyMsg && <div className="f-ok">{keyMsg}</div>}
      <div className="mail-grid">
        <div className="test-card">
          <h3>Infrastructure Health</h3>
          <p className="dim">Check the core stores used by the mail subsystem.</p>
          <button className="btn-sm" onClick={runHealth}>{health && health.loading ? "Checking…" : "Run Health Check"}</button>
          {health && health.checks && (
            <div className="test-results">
              {Object.entries(health.checks).map(([k, v]) => (
                <div key={k} className="row">
                  <span className="dim">{k}</span>
                  <span className={v.ok ? "ok" : "warn"}>{v.ok ? "OK" : v.error || "FAIL"}</span>
                </div>
              ))}
            </div>
          )}
          {health && health.error && <div className="f-err">{health.error}</div>}
        </div>

        <div className="test-card">
          <h3>Deliverability Readiness</h3>
          <p className="dim">Verify relay key, sender domains, and the DNS records the outbound path depends on.</p>
          <button className="btn-sm" onClick={runReadiness}>{readiness && readiness.loading ? "Checking…" : "Run Readiness"}</button>
          {readiness && (readiness.sender_domains || readiness.delivery) && (
            <div className="test-results">
              <div className="row"><span className="dim">Relay key</span><span className={readiness.relay_enabled ? "ok" : "warn"}>{readiness.relay_enabled ? "Ready" : "Missing"}</span></div>
              <div className="row"><span className="dim">DKIM signer</span><span className={readiness.dkim_configured ? "ok" : "warn"}>{readiness.dkim_configured ? "Configured" : "Missing"}</span></div>
              {readiness.delivery && (
                <>
                  <div className="row"><span className="dim">DKIM domain</span><span>{readiness.delivery.domain || "—"}</span></div>
                  <div className="row"><span className="dim">DKIM DNS</span><span className={readiness.delivery.dkim && readiness.delivery.dkim.ok ? "ok" : "warn"}>{readiness.delivery.dkim && readiness.delivery.dkim.ok ? "Published" : "Missing / mismatch"}</span></div>
                  <div className="row"><span className="dim">MX</span><span className={readiness.delivery.mx && readiness.delivery.mx.ok ? "ok" : "warn"}>{readiness.delivery.mx && readiness.delivery.mx.ok ? "Present" : "Missing"}</span></div>
                  <div className="row"><span className="dim">SPF</span><span className={readiness.delivery.spf && readiness.delivery.spf.ok ? "ok" : "warn"}>{readiness.delivery.spf && readiness.delivery.spf.ok ? "Present" : "Missing"}</span></div>
                  <div className="row"><span className="dim">DMARC</span><span className={readiness.delivery.dmarc && readiness.delivery.dmarc.ok ? "ok" : "warn"}>{readiness.delivery.dmarc && readiness.delivery.dmarc.ok ? "Present" : "Missing"}</span></div>
                </>
              )}
              <div className="row"><span className="dim">Keyserver</span><span className={readiness.keyserver_enabled ? "ok" : "warn"}>{readiness.keyserver_enabled ? "Enabled" : "Missing"}</span></div>
              <div className="row"><span className="dim">Sender domains</span><span>{(readiness.sender_domains || []).length}</span></div>
              <div className="row"><span className="dim">Ready</span><span className={readiness.ready_for_system_mail ? "ok" : "warn"}>{readiness.ready_for_system_mail ? "Yes" : "No"}</span></div>
            </div>
          )}
          {readiness && Array.isArray(readiness.issues) && readiness.issues.length > 0 && (
            <div className="test-results" style={{ marginTop: 8 }}>
              {readiness.issues.map((issue, idx) => (
                <div key={issue + idx} className="row">
                  <span className="dim">Issue</span>
                  <span className="warn">{issue}</span>
                </div>
              ))}
            </div>
          )}
          {readinessDNSGuide.length > 0 && (
            <div className="test-results" style={{ marginTop: 10 }}>
              <div className="row">
                <span className="dim">Guide</span>
                <span>Publish these DNS records, wait for DNS to propagate, then rerun readiness.</span>
              </div>
              {readinessDNSGuide.map((record) => (
                <details key={record.id} style={{ marginTop: 8 }}>
                  <summary className="dim">{record.label} setup</summary>
                  <div className="test-results" style={{ marginTop: 8 }}>
                    <div className="row"><span className="dim">Type</span><span>{record.type}</span></div>
                    <div className="row"><span className="dim">Host</span><span className="mono">{record.host || "@"}</span></div>
                    {record.fqdn && <div className="row"><span className="dim">FQDN</span><span className="mono tiny">{record.fqdn}</span></div>}
                    {record.extra && <div className="row"><span className="dim">Extra</span><span>{record.extra}</span></div>}
                    <div className="row"><span className="dim">TTL</span><span>{record.ttl || "Auto"}</span></div>
                    <div className="row"><span className="dim">Value</span><span className="mono tiny">{record.value}</span></div>
                    {record.note && <div className="f-help" style={{ marginTop: 6 }}>{record.note}</div>}
                  </div>
                </details>
              ))}
            </div>
          )}
          {readiness && readiness.error && <div className="f-err">{readiness.error}</div>}
        </div>

        <div className="test-card">
          <h3>SRP / Browser Auth</h3>
          <p className="dim">Audit the live browser-auth posture: SRP routes, user migration counts, and whether secure shells load the expected auth runtime.</p>
          <button className="btn-sm" onClick={runAuthPosture}>{authPosture && authPosture.loading ? "Checking…" : "Run Auth Audit"}</button>
          {authPosture && !authPosture.loading && !authPosture.error && (
            <div className="test-results">
              <div className="row"><span className="dim">SRP enabled</span><span className={authPosture.srp_enabled ? "ok" : "warn"}>{authPosture.srp_enabled ? "Yes" : "No"}</span></div>
              <div className="row"><span className="dim">Sessions</span><span className={authPosture.sessions_configured ? "ok" : "warn"}>{authPosture.sessions_configured ? "Configured" : "Missing"}</span></div>
              <div className="row"><span className="dim">SRP group</span><span>{authPosture.srp_group || "—"}</span></div>
              <div className="row"><span className="dim">SRP hash</span><span>{authPosture.srp_hash || "—"}</span></div>
              <div className="row"><span className="dim">Users (total)</span><span>{authPosture.store && authPosture.store.total_users != null ? authPosture.store.total_users : "—"}</span></div>
              <div className="row"><span className="dim">Users (SRP)</span><span>{authPosture.store && authPosture.store.srp_users != null ? authPosture.store.srp_users : "—"}</span></div>
              <div className="row"><span className="dim">Legacy auth users</span><span className={authPosture.store && Number(authPosture.store.legacy_users || 0) === 0 ? "ok" : "warn"}>{authPosture.store && authPosture.store.legacy_users != null ? authPosture.store.legacy_users : "—"}</span></div>
              <div className="row"><span className="dim">Disabled users</span><span>{authPosture.store && authPosture.store.disabled_users != null ? authPosture.store.disabled_users : "—"}</span></div>
              <div className="row"><span className="dim">Live SRP challenges</span><span>{authPosture.active_srp_challenges != null ? authPosture.active_srp_challenges : "—"}</span></div>
              {authPosture.pages && Object.entries(authPosture.pages).map(([name, page]) => (
                <div key={name} className="row">
                  <span className="dim">{name} shell</span>
                  <span className={page && page.ok ? "ok" : "warn"}>{page && page.ok ? "Ready" : "Needs review"}</span>
                </div>
              ))}
              <div className="row"><span className="dim">Unlock persistence</span><span className={authPosture.unlock_memory_only ? "ok" : "warn"}>{authPosture.unlock_memory_only ? "Memory-only" : "Persistent"}</span></div>
            </div>
          )}
          {authPosture && authPosture.error && <div className="f-err">{authPosture.error}</div>}
          <JsonBlock value={authPosture && !authPosture.loading && !authPosture.error ? authPosture : null} />
        </div>

        <div className="test-card">
          <h3>Ultra-Private Posture</h3>
          <p className="dim">Check encrypted-by-default metadata, secure-shell headers, inbound SMTP gateway encryption, and whether user-authored plaintext relay is shut off.</p>
          <button className="btn-sm" onClick={runPrivacyPosture}>{privacyPosture && privacyPosture.loading ? "Checking…" : "Run Privacy Audit"}</button>
          {privacyPosture && !privacyPosture.loading && !privacyPosture.error && (
            <div className="test-results">
              <div className="row"><span className="dim">Metadata default</span><span className={privacyPosture.default_metadata_encrypted ? "ok" : "warn"}>{privacyPosture.default_metadata_encrypted ? "Encrypted / opt-in" : "Readable by default"}</span></div>
              <div className="row"><span className="dim">Plaintext relay (user)</span><span className={privacyPosture.user_plaintext_relay_disabled ? "ok" : "warn"}>{privacyPosture.user_plaintext_relay_disabled ? "Disabled" : "Enabled"}</span></div>
              <div className="row"><span className="dim">Unlock persistence</span><span className={privacyPosture.unlock_memory_only ? "ok" : "warn"}>{privacyPosture.unlock_memory_only ? "Memory-only" : "Persistent"}</span></div>
              <div className="row"><span className="dim">SMTP plaintext ingress</span><span className={privacyPosture.smtp_plaintext_gateway_encryption ? "ok" : "warn"}>{privacyPosture.smtp_plaintext_gateway_encryption ? "Gateway-encrypted" : "Needs review"}</span></div>
              <div className="row"><span className="dim">Referrer policy</span><span>{privacyPosture.secure_headers && privacyPosture.secure_headers.referrer_policy || "—"}</span></div>
              <div className="row"><span className="dim">Frame protection</span><span>{privacyPosture.secure_headers && privacyPosture.secure_headers.x_frame_options || "—"}</span></div>
              {privacyPosture.pages && Object.entries(privacyPosture.pages).map(([name, page]) => (
                <div key={name} className="row">
                  <span className="dim">{name} shell</span>
                  <span className={page && page.ok ? "ok" : "warn"}>{page && page.ok ? "Clean" : "Needs review"}</span>
                </div>
              ))}
            </div>
          )}
          {privacyPosture && privacyPosture.error && <div className="f-err">{privacyPosture.error}</div>}
          <JsonBlock value={privacyPosture && !privacyPosture.loading && !privacyPosture.error ? privacyPosture : null} />
        </div>

        <div className="test-card">
          <h3>Relay Key</h3>
          <p className="dim">Manage the server-side relay key used to wrap plaintext-relay mail at rest.</p>
          <button className="btn-sm" onClick={loadKeyMaterial}>
            {keyMaterial && keyMaterial.loading ? "Loading…" : "Refresh Key Status"}
          </button>
          {keyMaterial && keyMaterial.relay && (
            <div className="test-results">
              <div className="row"><span className="dim">Present</span><span className={keyMaterial.relay.present ? "ok" : "warn"}>{keyMaterial.relay.present ? "Yes" : "No"}</span></div>
              <div className="row"><span className="dim">Path</span><span className="mono">{keyMaterial.relay.path || "—"}</span></div>
              <div className="row"><span className="dim">Fingerprint</span><span className="mono tiny">{keyMaterial.relay.fingerprint || "—"}</span></div>
              <div className="row"><span className="dim">Public hash</span><span className="mono tiny">{keyMaterial.relay.public_hash || "—"}</span></div>
              {keyMaterial.relay.error && <div className="f-err">{keyMaterial.relay.error}</div>}
            </div>
          )}
          <button className="btn-sm primary" style={{ marginTop: 10 }} onClick={() => setConfirmKeyAction("relay")}>
            Generate / Rotate Relay Key
          </button>
        </div>

        <div className="test-card">
          <h3>DKIM Key</h3>
          <p className="dim">Manage the active DKIM signer domain/selector, then generate a key or upload an existing PEM. Changes hot-reload into the outbound worker.</p>
          {keyMaterial && keyMaterial.dkim && (
            <div className="test-results">
              <div className="row"><span className="dim">Present</span><span className={keyMaterial.dkim.present ? "ok" : "warn"}>{keyMaterial.dkim.present ? "Yes" : "No"}</span></div>
              <div className="row"><span className="dim">Configured</span><span className={keyMaterial.dkim.configured ? "ok" : "warn"}>{keyMaterial.dkim.configured ? "Yes" : "No"}</span></div>
              <div className="row"><span className="dim">Path</span><span className="mono">{keyMaterial.dkim.path || "—"}</span></div>
              <div className="row"><span className="dim">Selector</span><span>{keyMaterial.dkim.selector || "—"}</span></div>
              <div className="row"><span className="dim">Domain</span><span>{keyMaterial.dkim.domain || "—"}</span></div>
              <div className="row"><span className="dim">DNS name</span><span className="mono tiny">{keyMaterial.dkim.dns_name || "—"}</span></div>
              {keyMaterial.dkim.public_txt && (
                <details style={{ marginTop: 8 }}>
                  <summary className="dim">DKIM DNS TXT</summary>
                  <pre className="test-output">{keyMaterial.dkim.public_txt}</pre>
                </details>
              )}
              {keyMaterial.dkim.error && <div className="f-err">{keyMaterial.dkim.error}</div>}
            </div>
          )}
          <div className="system-mail-grid" style={{ marginTop: 10 }}>
            <input
              className="inp"
              placeholder="Selector"
              value={form.dkim_selector}
              onChange={(e) => setForm((f) => ({ ...f, dkim_selector: e.target.value }))}
            />
            <input
              className="inp"
              placeholder="example.com"
              value={form.dkim_domain}
              onChange={(e) => setForm((f) => ({ ...f, dkim_domain: e.target.value }))}
            />
          </div>
          <div className="f-help">DNS name preview: <code>{dkimDNSPreview || "—"}</code></div>
          <div className="mail-actions">
            <button className="btn-sm" onClick={async () => {
              setKeyMsg("");
              closeKeyAlert();
              try {
                const res = await apiJSON("/api/admin/test/key-material/dkim/config", {
                  method: "POST",
                  body: JSON.stringify({
                    selector: form.dkim_selector,
                    domain: form.dkim_domain
                  })
                });
                setKeyMsg(`DKIM settings saved. Active DNS name: ${res.dns_name || "configure a domain to derive it"}.`);
                await loadKeyMaterial();
                await runReadiness();
              } catch (e) {
                showKeyAlert("DKIM config update failed", e);
              }
            }}>Save DKIM Settings</button>
            <button className="btn-sm primary" onClick={() => setConfirmKeyAction("dkim")}>
              Generate DKIM Key
            </button>
            <button className="btn-sm" onClick={async () => {
              setKeyMsg("");
              closeKeyAlert();
              try {
                const res = await apiJSON("/api/admin/test/key-material/dkim/upload", {
                  method: "POST",
                  body: JSON.stringify({ pem: form.dkim_pem })
                });
                setKeyMsg(`DKIM key uploaded. Active DNS name: ${res.dns_name || "configured name"}.`);
                setForm((f) => ({ ...f, dkim_pem: "" }));
                await loadKeyMaterial();
                await runReadiness();
              } catch (e) {
                showKeyAlert("DKIM key upload failed", e);
              }
            }}>Upload DKIM PEM</button>
          </div>
          <textarea
            className="txa tall"
            style={{ marginTop: 10 }}
            placeholder="Paste a PKCS#1 or PKCS#8 RSA private key PEM to replace the current DKIM key…"
            value={form.dkim_pem}
            onChange={(e) => setForm((f) => ({ ...f, dkim_pem: e.target.value }))}
          />
        </div>

        <div className="test-card" style={{ gridColumn: "1 / -1" }}>
          <h3>Admin Test Composer</h3>
          <p className="dim">Send plaintext or protected-link test messages to selected Elvish users, external inboxes, or both.</p>
          {testErr && <div className="f-err">{testErr}</div>}
          {testMsg && <div className="f-ok">{testMsg}</div>}
          <div className="col" style={{ gap: 12 }}>
            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Sender</div>
              <div className="system-mail-grid">
                <input
                  className="inp"
                  placeholder="Local part"
                  value={form.test_local_part}
                  onChange={(e) => setForm((f) => ({ ...f, test_local_part: e.target.value }))}
                />
                <select
                  className="sel"
                  value={form.test_domain}
                  onChange={(e) => setForm((f) => ({ ...f, test_domain: e.target.value }))}
                >
                  <option value="">Select a verified domain…</option>
                  {senderDomains.map((d) => (
                    <option key={d.domain} value={d.domain}>
                      {d.domain}{d.is_default ? " (default)" : ""} ({d.source})
                    </option>
                  ))}
                </select>
              </div>
              <div className="f-help">From address preview: <code>{computedTestFromAddr || "—"}</code></div>
            </div>

            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Recipients</div>
              <div className="search-bar">
                <input
                  className="inp"
                  placeholder="Search platform users by email…"
                  value={testSearchQuery}
                  onChange={(e) => setTestSearchQuery(e.target.value)}
                />
                <button className="btn-sm" onClick={searchTestUsers}>{testSearching ? "Searching…" : "Search"}</button>
              </div>
              <div className="selected-users" style={{ marginTop: 8 }}>
                {selectedTestUsers.length === 0 && <div className="dim">No platform users selected.</div>}
                {selectedTestUsers.map((u) => (
                  <div key={u.id} className="selected-user">
                    <div className="col">
                      <strong>{u.email}</strong>
                      <span className="dim">{u.name || "No name"} · {u.id.slice(0, 8)}</span>
                    </div>
                    <button className="btn-sm" onClick={() => setSelectedTestUsers((list) => list.filter((x) => x.id !== u.id))}>Remove</button>
                  </div>
                ))}
              </div>
              {testSearchResults.length > 0 && (
                <div className="search-results" style={{ marginTop: 8 }}>
                  {testSearchResults.map((u) => (
                    <div key={u.id} className="search-result-row">
                      <div className="col">
                        <strong>{u.email}</strong>
                        <span className="dim">{u.name || "No name"} · created {fmtDT(u.created_at)}</span>
                      </div>
                      <button className="btn-sm primary" onClick={() => setSelectedTestUsers((list) => [...list, u])}>Add</button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="txa"
                style={{ marginTop: 8 }}
                placeholder={"External inboxes (comma or newline separated)\nqa@example.com\ndeliverability@external.test"}
                value={form.test_external_emails}
                onChange={(e) => setForm((f) => ({ ...f, test_external_emails: e.target.value }))}
              />
              <div className="f-help">Resolved recipient set: <code>{testRecipientEmails.length}</code></div>
            </div>

            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Mode</div>
              <A.Seg
                value={form.test_send_mode}
                onChange={(v) => {
                  setForm((f) => ({ ...f, test_send_mode: v }));
                  setTestPreview(null);
                  setTestResult(null);
                  setTestErr("");
                }}
                options={[
                  { value: "plaintext", label: "Plaintext relay" },
                  { value: "protected_link", label: "Protected link" }
                ]}
              />
            </div>

            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Subject</div>
              <input
                className="inp"
                placeholder="Announcement subject"
                value={form.test_subject}
                onChange={(e) => setForm((f) => ({ ...f, test_subject: e.target.value }))}
              />
            </div>

            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Body</div>
              <textarea
                className="txa tall"
                placeholder="Compose the test message body…"
                value={form.test_body_text}
                onChange={(e) => setForm((f) => ({ ...f, test_body_text: e.target.value }))}
              />
            </div>

            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Attachments</div>
              <input
                className="inp"
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  setTestAttachments((list) => list.concat(files.map((file, idx) => ({
                    local_id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
                    file,
                    file_name: sanitizeAttachmentName(file.name),
                    content_type: sanitizeAttachmentType(file.type),
                    size_bytes: Number(file.size || 0),
                    upload_id: "",
                    uploading: false,
                    error: ""
                  }))));
                  e.target.value = "";
                }}
              />
              <div className="selected-users" style={{ marginTop: 8 }}>
                {testAttachments.length === 0 && <div className="dim">No attachments selected.</div>}
                {testAttachments.map((att) => (
                  <div key={att.local_id} className="selected-user">
                    <div className="col">
                      <strong>{att.file_name}</strong>
                      <span className="dim">
                        {fmtBytes(att.size_bytes)} · {att.content_type || "application/octet-stream"}
                        {att.uploading ? " · uploading…" : att.upload_id ? " · uploaded for plaintext send" : ""}
                      </span>
                      {att.error && <span className="warn">{att.error}</span>}
                    </div>
                    <button className="btn-sm" onClick={() => setTestAttachments((list) => list.filter((x) => x.local_id !== att.local_id))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>

            {form.test_send_mode === "protected_link" && (
              <div className="test-results">
                <div className="row">
                  <span className="dim">Notify recipients</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!form.test_notify_recipients}
                      onChange={(e) => setForm((f) => ({ ...f, test_notify_recipients: e.target.checked }))}
                    />
                    <span>Send the protected-link notice email through the normal mail path.</span>
                  </label>
                </div>
                <div className="system-mail-grid" style={{ marginTop: 10 }}>
                  <input
                    className="inp"
                    type="password"
                    placeholder="Protected-link password"
                    value={form.test_password}
                    onChange={(e) => setForm((f) => ({ ...f, test_password: e.target.value }))}
                  />
                  <input
                    className="inp"
                    type="password"
                    placeholder="Confirm password"
                    value={form.test_password_confirm}
                    onChange={(e) => setForm((f) => ({ ...f, test_password_confirm: e.target.value }))}
                  />
                </div>
                <div className="system-mail-grid" style={{ marginTop: 10 }}>
                  <input
                    className="inp"
                    type="number"
                    min="1"
                    max="30"
                    placeholder="TTL (days)"
                    value={form.test_ttl_days}
                    onChange={(e) => setForm((f) => ({ ...f, test_ttl_days: e.target.value }))}
                  />
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="Max views (0 = unlimited)"
                    value={form.test_max_views}
                    onChange={(e) => setForm((f) => ({ ...f, test_max_views: e.target.value }))}
                  />
                </div>
                <div className="f-help">Protected-link payloads are encrypted in this browser tab before upload. Attachments stay client-side until the encrypted package is created.</div>
              </div>
            )}

            <div className="mail-actions">
              <button className="btn-sm" onClick={runTestPreview}>Preview</button>
              <button className="btn-sm primary" disabled={testSending} onClick={runTestSend}>
                {testSending ? "Sending…" : "Send Test Mail"}
              </button>
            </div>

            {testPreview && (
              <div className="test-results">
                <div className="row"><span className="dim">Mode</span><span>{testPreview.send_mode || "plaintext"}</span></div>
                <div className="row"><span className="dim">Recipients</span><span>{testPreview.recipient_count || 0}</span></div>
                <div className="row"><span className="dim">Local delivery</span><span>{testPreview.local_recipient_count || 0}</span></div>
                <div className="row"><span className="dim">External delivery</span><span>{testPreview.external_recipient_count || 0}</span></div>
                <div className="row"><span className="dim">Attachments</span><span>{testPreview.attachment_count || 0} · {fmtBytes(testPreview.attachment_bytes || 0)}</span></div>
                <div className="row"><span className="dim">Relay ready</span><span className={testPreview.relay_enabled ? "ok" : "warn"}>{testPreview.relay_enabled ? "Yes" : "No"}</span></div>
                <div className="row"><span className="dim">Protected-link ready</span><span className={testPreview.protected_link_enabled ? "ok" : "warn"}>{testPreview.protected_link_enabled ? "Yes" : "No"}</span></div>
              </div>
            )}
            <JsonBlock value={testPreview && testPreview.sample ? testPreview : null} />
            <JsonBlock value={testResult} />
          </div>
        </div>

        <div className="test-card">
          <h3>Keyserver Probe</h3>
          <p className="dim">Resolve one public key through the configured lookup chain.</p>
          <input className="inp" placeholder="user@example.com" value={form.key_email} onChange={(e) => setForm((f) => ({ ...f, key_email: e.target.value }))} />
          <button className="btn-sm" style={{ marginTop: 10 }} onClick={runKeyserver}>{keyserverResult && keyserverResult.loading ? "Running…" : "Run Probe"}</button>
          <JsonBlock value={keyserverResult && !keyserverResult.loading ? keyserverResult : null} />
        </div>

        <div className="test-card">
          <h3>Wrap Roundtrip</h3>
          <p className="dim">Verify the same KDF + AES-GCM cycle the browser depends on.</p>
          <select className="sel" value={form.wrap_kdf} onChange={(e) => setForm((f) => ({ ...f, wrap_kdf: e.target.value }))}>
            <option value="argon2id">argon2id</option>
            <option value="pbkdf2-sha256">pbkdf2-sha256</option>
          </select>
          <button className="btn-sm" style={{ marginTop: 10 }} onClick={runWrap}>{wrapResult && wrapResult.loading ? "Running…" : "Run Check"}</button>
          <JsonBlock value={wrapResult && !wrapResult.loading ? wrapResult : null} />
        </div>
      </div>
    </div>
    {M && (
      <M.NotifyModal
        open={!!keyAlert}
        onClose={closeKeyAlert}
        kind={keyAlert?.kind}
        title={keyAlert?.title}
        body={keyAlert?.body}
      />
    )}

    {confirmKeyAction && (
      <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !keyActionBusy) setConfirmKeyAction(null); }}>
        <div style={{ background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 480, width: "90%", position: "relative" }}>
          <div style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
          <div style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {confirmKeyAction === "relay" ? "Generate Relay Key" : "Generate DKIM Key"}
            </span>
            <button type="button" className="btn-close" onClick={() => setConfirmKeyAction(null)} disabled={keyActionBusy}>×</button>
          </div>
          <div style={{ padding: 18 }}>
            <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
              {confirmKeyAction === "relay"
                ? "Generate or rotate the relay key? Existing queued plaintext-relay payloads encrypted to the old key may stop decrypting."
                : "Generate a new DKIM private key and replace the current one?"}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn-sm" onClick={() => setConfirmKeyAction(null)} disabled={keyActionBusy}>Cancel</button>
              <button
                type="button"
                className="btn-sm primary"
                disabled={keyActionBusy}
                onClick={async () => {
                  setKeyActionBusy(true);
                  setKeyMsg("");
                  closeKeyAlert();
                  try {
                    if (confirmKeyAction === "relay") {
                      const res = await apiJSON("/api/admin/test/key-material/relay/generate", { method: "POST", body: "{}" });
                      setKeyMsg(`Relay key active: ${String(res.fingerprint || "").slice(-16)}.`);
                    } else {
                      const res = await apiJSON("/api/admin/test/key-material/dkim/generate", { method: "POST", body: "{}" });
                      setKeyMsg(`DKIM key generated. Publish TXT at ${res.dns_name || "the configured DNS name"}.`);
                    }
                    setConfirmKeyAction(null);
                    await loadKeyMaterial();
                    await runReadiness();
                  } catch (e) {
                    showKeyAlert(confirmKeyAction === "relay" ? "Relay key action failed" : "DKIM key generation failed", e);
                  } finally {
                    setKeyActionBusy(false);
                  }
                }}
              >
                {keyActionBusy ? "Working…" : "Generate Key"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function SecSystemMail() {
  const [config, setConfig] = useSt(null);
  const [runs, setRuns] = useSt([]);
  const [searchQuery, setSearchQuery] = useSt("");
  const [searchResults, setSearchResults] = useSt([]);
  const [searching, setSearching] = useSt(false);
  const [selectedUsers, setSelectedUsers] = useSt([]);
  const [form, setForm] = useSt({
    audience_kind: "selected",
    local_part: "announcements",
    domain: "",
    subject: "",
    body_text: ""
  });
  const [preview, setPreview] = useSt(null);
  const [sending, setSending] = useSt(false);
  const [confirmBulk, setConfirmBulk] = useSt(false);
  const [msg, setMsg] = useSt("");
  const [err, setErr] = useSt("");

  const senderDomains = (config && config.sender_domains) || [];
  const computedFromAddr = form.domain ? `${form.local_part.trim() || "announcements"}@${form.domain}` : "";

  const load = useCb(async () => {
    try {
      const cfg = await apiJSON("/api/admin/system-mail");
      setConfig(cfg);
      setRuns((await apiJSON("/api/admin/system-mail/runs")).items || []);
      const fallbackDomain = (cfg.sender_domains && cfg.sender_domains[0] && cfg.sender_domains[0].domain) || "";
      const preferredFrom = splitEmail(cfg.default_from_addr || "");
      setForm((f) => ({
        ...f,
        local_part: f.local_part || preferredFrom.local || "announcements",
        domain: f.domain || preferredFrom.domain || fallbackDomain
      }));
    } catch (e) {
      setErr(String(e.message || e));
    }
  }, []);

  useEf(() => { load(); }, [load]);

  const searchUsers = async () => {
    setSearching(true);
    try {
      const data = await apiJSON(`/api/admin/users?page=1&limit=10&q=${encodeURIComponent(searchQuery)}`);
      const next = (data.users || []).filter((u) => !selectedUsers.some((s) => s.id === u.id));
      setSearchResults(next);
    } catch (e) {
      setErr(String(e.message || e));
    }
    setSearching(false);
  };

  const payload = useMm(() => ({
    audience_kind: form.audience_kind,
    user_ids: selectedUsers.map((u) => u.id),
    from_addr: computedFromAddr,
    subject: String(form.subject || "").trim(),
    body_text: String(form.body_text || "").trim()
  }), [form, selectedUsers, computedFromAddr]);

  const needsConfirm = form.audience_kind !== "selected" || ((preview && preview.recipient_count) || selectedUsers.length) > 1;

  return (
    <div data-testid="admin-system-mail-panel">
      <A.H num="06" title="SYSTEM MAIL" sub="preview · queue securely · audit recent runs" />
      <div className="adm-explain">
        System email is queued through the same relay-wrapped outbox and worker path as other server-authored mail. The server stores only wrapped payloads at rest, sender domains are restricted, and bulk sends require an explicit confirmation step.
      </div>
      {err && <div className="f-err">{err}</div>}
      {msg && <div className="f-ok">{msg}</div>}
      <A.Card title="COMPOSE SYSTEM MAIL" right={config ? `${config.active_user_count || 0} active users` : "loading…" }>
        <A.FRow label="Audience" hint="Target selected users or queue a platform-wide announcement to all active users.">
          <A.Seg
            value={form.audience_kind}
            onChange={(v) => {
              setForm((f) => ({ ...f, audience_kind: v }));
              setPreview(null);
              setConfirmBulk(false);
            }}
            options={[
              { value: "selected", label: "Selected users" },
              { value: "all_active", label: "All active users" }
            ]}
          />
        </A.FRow>

        {form.audience_kind === "selected" && (
          <A.FRow label="Recipients" hint="Search by email, add one or more platform users, then preview before queueing.">
            <div className="col" style={{ gap: 10 }}>
              <div className="search-bar">
                <input className="inp" placeholder="Search users by email…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <button className="btn-sm" onClick={searchUsers}>{searching ? "Searching…" : "Search"}</button>
              </div>
              <div className="selected-users">
                {selectedUsers.length === 0 && <div className="dim">No users selected.</div>}
                {selectedUsers.map((u) => (
                  <div key={u.id} className="selected-user">
                    <div className="col">
                      <strong>{u.email}</strong>
                      <span className="dim">{u.name || "No name"} · {u.id.slice(0, 8)}</span>
                    </div>
                    <button className="btn-sm" onClick={() => setSelectedUsers((list) => list.filter((x) => x.id !== u.id))}>Remove</button>
                  </div>
                ))}
              </div>
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((u) => (
                    <div key={u.id} className="search-result-row">
                      <div className="col">
                        <strong>{u.email}</strong>
                        <span className="dim">{u.name || "No name"} · created {fmtDT(u.created_at)}</span>
                      </div>
                      <button className="btn-sm primary" onClick={() => setSelectedUsers((list) => [...list, u])}>Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </A.FRow>
        )}

        <A.FRow label="Sender" hint="The domain must come from the verified sender-domain list.">
          <div className="system-mail-grid">
            <input className="inp" placeholder="Local part" value={form.local_part} onChange={(e) => setForm((f) => ({ ...f, local_part: e.target.value }))} />
            <select className="sel" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}>
              <option value="">Select a verified domain…</option>
              {senderDomains.map((d) => <option key={d.domain} value={d.domain}>{d.domain}{d.is_default ? " (default)" : ""} ({d.source})</option>)}
            </select>
          </div>
          <div className="f-help">From address preview: <code>{computedFromAddr || "—"}</code></div>
        </A.FRow>

        <A.FRow label="Subject" req>
          <A.Input value={form.subject} onChange={(v) => setForm((f) => ({ ...f, subject: v }))} placeholder="Announcement subject" />
        </A.FRow>
        <A.FRow label="Body" req hint="Text-only in the first version to keep the send path constrained and auditable.">
          <A.Textarea tall value={form.body_text} onChange={(v) => setForm((f) => ({ ...f, body_text: v }))} placeholder="System announcement body…" />
        </A.FRow>

        <div className="mail-actions">
          <button className="btn-sm" onClick={async () => {
            setErr("");
            setMsg("");
            setConfirmBulk(false);
            const validationErr = validateSystemMailPayload(payload, selectedUsers);
            if (validationErr) {
              setPreview(null);
              setErr(validationErr);
              return;
            }
            try {
              setPreview(await apiJSON("/api/admin/system-mail/preview", {
                method: "POST",
                body: JSON.stringify(payload)
              }));
            } catch (e) {
              setPreview(null);
              setErr(String(e.message || e));
            }
          }}>Preview</button>
          <button className="btn-sm primary" disabled={!preview || sending || (needsConfirm && !confirmBulk)} onClick={async () => {
            setSending(true);
            setErr("");
            setMsg("");
            const validationErr = validateSystemMailPayload(payload, selectedUsers);
            if (validationErr) {
              setSending(false);
              setErr(validationErr);
              return;
            }
            try {
              const res = await apiJSON("/api/admin/system-mail/send", {
                method: "POST",
                body: JSON.stringify(payload)
              });
              setMsg(`Queued ${res.queued_count} message(s). Run ${String(res.run_id || "").slice(0, 8)} created.`);
              setPreview(res);
              setSelectedUsers([]);
              setSearchResults([]);
              setSearchQuery("");
              setConfirmBulk(false);
              load();
            } catch (e) {
              setErr(String(e.message || e));
            }
            setSending(false);
          }}>{sending ? "Queueing…" : "Queue System Mail"}</button>
        </div>

        {needsConfirm && (
          <label className="tgl" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={confirmBulk} onChange={(e) => setConfirmBulk(e.target.checked)} />
            <span className="tgl-track"></span>
            Confirm this {form.audience_kind === "all_active" ? "bulk" : "multi-recipient"} send.
          </label>
        )}

        {preview && (
          <div className="preview-box">
            <div className="preview-row"><span className="dim">From</span><span>{preview.from_addr || computedFromAddr}</span></div>
            <div className="preview-row"><span className="dim">Recipients</span><span>{preview.recipient_count || preview.queued_count || 0}</span></div>
            <div className="preview-row"><span className="dim">Body chars</span><span>{preview.body_chars || form.body_text.length}</span></div>
            {Array.isArray(preview.sample) && preview.sample.length > 0 && (
              <div className="preview-list">
                {preview.sample.map((u) => <span key={u.id || u.email} className="chip">{u.email}</span>)}
              </div>
            )}
            {Array.isArray(preview.errors) && preview.errors.length > 0 && (
              <div className="f-err" style={{ marginTop: 10 }}>{preview.errors.join(" | ")}</div>
            )}
          </div>
        )}
      </A.Card>

      <A.Card title="RECENT SYSTEM MAIL RUNS" right={<button className="btn-sm" onClick={load}>Refresh</button>}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Audience</th>
              <th>Sender</th>
              <th>Queued</th>
              <th>Pending</th>
              <th>Sent</th>
              <th>Failed</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && <tr><td colSpan="8" className="dim">No system mail runs yet.</td></tr>}
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.subject}</td>
                <td>{run.audience_kind}</td>
                <td>{run.sender_addr}</td>
                <td>{run.queued_count}/{run.recipient_count}</td>
                <td>{run.pending_count}</td>
                <td className="ok">{run.sent_count}</td>
                <td className={run.failed_count ? "warn" : ""}>{run.failed_count}</td>
                <td className="dim">{fmtDT(run.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </A.Card>
    </div>
  );
}

window.SecUsers = SecUsers;
window.SecOutbox = SecOutbox;
window.SecDomains = SecDomains;
window.SecMailTest = SecMailTest;
window.SecSystemMail = SecSystemMail;
