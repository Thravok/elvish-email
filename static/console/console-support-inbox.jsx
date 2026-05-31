// Console support inbox — shared support mailbox with key escrow.
const { useState, useEffect, useCallback } = React;

function apiJSON(path, opts) {
  return fetch(path, { credentials: "include", ...opts }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "request failed");
    return j;
  });
}

function SecSupportInbox() {
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      const cfg = await apiJSON("/api/support/config");
      setConfig(cfg);
      if (!cfg.configured) {
        setItems([]);
        return;
      }
      const data = await apiJSON("/api/support/inbox");
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "load failed");
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const openMessage = async (id) => {
    setSelected(id);
    setDetail(null);
    setReplyText("");
    try {
      const d = await apiJSON(`/api/support/inbox/${encodeURIComponent(id)}`);
      setDetail(d);
    } catch (e) {
      setErr(e.message || "read failed");
    }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await apiJSON(`/api/support/inbox/${encodeURIComponent(selected)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_text: replyText, subject: detail?.subject ? `Re: ${detail.subject}` : "Re: support" })
      });
      setReplyText("");
      await loadInbox();
    } catch (e) {
      setErr(e.message || "reply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="ftk">// SUPPORT INBOX</div>
      <p className="dim" style={{ marginTop: 8, maxWidth: 720 }}>
        Shared support mailbox backed by key escrow. Configure the platform support user and import vault keys (super_admin) before use.
      </p>
      {err && <p className="err" style={{ marginTop: 12 }}>{err}</p>}
      {!config?.configured && (
        <p style={{ marginTop: 16 }} className="dim">Support mailbox not configured. Set platform user via PUT /api/support/config.</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, marginTop: 20 }}>
        <div>
          <div className="ftk" style={{ marginBottom: 8 }}>THREADS</div>
          <ul className="adm-list">
            {(items || []).map((it) => (
              <li key={it.message_id}>
                <button type="button" className="btn-sm" style={{ width: "100%", textAlign: "left" }} onClick={() => openMessage(it.message_id)}>
                  <strong>{it.subject || "(no subject)"}</strong>
                  <br />
                  <span className="dim">{it.from || "unknown"} · {it.received_at}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {detail && (
            <>
              <div className="ftk">MESSAGE</div>
              <p><strong>{detail.subject}</strong> — {detail.from}</p>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, padding: 12, border: "1px solid var(--fg-dim)" }}>
                {detail.body_text || detail.body_error || "(no body)"}
              </pre>
              <textarea
                rows={6}
                style={{ width: "100%", marginTop: 12 }}
                placeholder="Reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button className="btn-sm primary" style={{ marginTop: 8 }} disabled={busy} onClick={sendReply}>
                Send reply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.SecSupportInbox = SecSupportInbox;
