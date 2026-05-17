// ELVISH admin — Cap captcha for /login and /register
const AT = window.adm;
const { useState: useS_c, useEffect: useE_c } = React;

function SecAuthCaptcha() {
  const [me, setMe] = useS_c(null);
  const [data, setData] = useS_c(null);
  const [err, setErr] = useS_c("");
  const [msg, setMsg] = useS_c("");
  const [saving, setSaving] = useS_c(false);
  const [form, setForm] = useS_c({
    enabled: false,
    widget_api_endpoint: "",
    secret: ""
  });

  useE_c(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMe(j.user || null))
      .catch(() => setMe(null));
  }, []);

  const load = () => {
    setErr("");
    setMsg("");
    fetch("/api/admin/auth-captcha", { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setData(d);
        const st = d.settings || {};
        setForm({
          enabled: st.enabled === true,
          widget_api_endpoint: typeof st.widget_api_endpoint === "string" ? st.widget_api_endpoint : "",
          secret: ""
        });
      })
      .catch((e) => setErr(String(e.message || e)));
  };

  useE_c(() => {
    if (me && me.is_admin) load();
  }, [me]);

  const save = () => {
    setSaving(true);
    setErr("");
    setMsg("");
    fetch("/api/admin/auth-captcha", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !!form.enabled,
        widget_api_endpoint: String(form.widget_api_endpoint || "").trim(),
        secret: String(form.secret || "").trim()
      })
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || String(r.status));
        return j;
      })
      .then(() => {
        setMsg("Saved.");
        setForm((f) => ({ ...f, secret: "" }));
        load();
      })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setSaving(false));
  };

  if (!me) {
    return (
      <>
        <AT.H num="09" title="LOGIN CAPTCHA" sub="Cap · admin only" />
        <div className="adm-explain"><a href="/login">Log in</a> to manage captcha settings.</div>
      </>
    );
  }
  if (!me.is_admin) {
    return (
      <>
        <AT.H num="09" title="LOGIN CAPTCHA" sub="Cap · admin only" />
        <div className="adm-explain">Your account is not an admin.</div>
      </>
    );
  }

  const st = (data && data.settings) || {};
  const persist = data && data.persist;

  return (
    <div data-testid="admin-auth-captcha-panel">
      <AT.H num="09" title="LOGIN CAPTCHA" sub="Cap self-hosted · /login and /register" />
      <div className="adm-explain">
        Configure your <a href="https://trycap.dev/" target="_blank" rel="noreferrer">Cap</a> instance. Use the widget API URL from the Cap dashboard
        (form <code className="mono">https://your-host/&lt;site-key&gt;/</code>). The server verifies tokens at <code className="mono">/siteverify</code> on the same host.
      </div>
      {!persist && <div className="readonly-note" style={{ marginBottom: 12 }}>Database not configured — settings cannot be persisted.</div>}
      {err && <div className="auth-status err" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="auth-status ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <AT.Card title="CAP SETTINGS" right={<button type="button" className="btn-sm primary" disabled={saving || !persist} onClick={save}>{saving ? "…" : "▸ save"}</button>}>
        <AT.FRow label="Enabled" hint="When on, /login and /register require a solved Cap token before SRP or registration proceeds.">
          <AT.Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label={form.enabled ? "ON" : "OFF"} />
        </AT.FRow>
        <AT.FRow label="Widget API URL" req={form.enabled} hint="Exact Cap widget endpoint (https, includes site key path, trailing slash recommended).">
          <AT.Input value={form.widget_api_endpoint} onChange={(v) => setForm((f) => ({ ...f, widget_api_endpoint: v }))} placeholder="https://cap.example.com/your-site-key/" />
        </AT.FRow>
        <AT.FRow label="Secret" hint="Site secret for server-side verification. Leave blank when saving to keep the current secret.">
          <AT.Input value={form.secret} onChange={(v) => setForm((f) => ({ ...f, secret: v }))} placeholder={st.secret_configured ? "•••••• (unchanged if empty)" : "paste secret from Cap dashboard"} />
        </AT.FRow>
        {st.fully_active && <div className="dim" style={{ marginTop: 8 }}>Status: <strong>active</strong> on public login and registration.</div>}
        {form.enabled && !st.fully_active && persist && (
          <div className="readonly-note" style={{ marginTop: 8 }}>Enabled but not active until both URL and secret are set.</div>
        )}
      </AT.Card>
    </div>
  );
}

window.SecAuthCaptcha = SecAuthCaptcha;
