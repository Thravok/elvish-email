// Platform operator settings (URLs, auth policy, mail domain).
const { useState: useS_plat, useEffect: useE_plat, useCallback: useC_plat } = React;

function SecPlatform() {
  const [data, setData] = useS_plat(null);
  const [form, setForm] = useS_plat(null);
  const [loading, setLoading] = useS_plat(true);
  const [saving, setSaving] = useS_plat(false);
  const [msg, setMsg] = useS_plat("");
  const [err, setErr] = useS_plat("");

  const load = useC_plat(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/operator-settings", { credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setData(j);
      const st = j.settings || {};
      setForm({
        public_base_url: st.public_base_url || "",
        platform_mail_domain: st.platform_mail_domain || "",
        web_origins: st.web_origins || "",
        cookie_domain: st.cookie_domain || "",
        registration_closed: !!st.registration_closed,
        paid_features_enabled: !!st.paid_features_enabled,
        trust_forwarded_for: !!st.trust_forwarded_for,
        content_cache_sec: st.content_cache_sec != null ? st.content_cache_sec : 10,
        smtp_rate_limit_per_hour: st.smtp_rate_limit_per_hour != null ? st.smtp_rate_limit_per_hour : 100
      });
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useE_plat(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form || !data?.persist) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/operator-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg("Platform settings saved.");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="adm-page" data-testid="admin-platform-panel">
        <AP.H num="12" title="PLATFORM" sub="URLs · auth policy · mail domain" />
        <div className="dim">Loading…</div>
      </div>
    );
  }

  if (!data?.persist) {
    return (
      <div className="adm-page" data-testid="admin-platform-panel">
        <AP.H num="12" title="PLATFORM" sub="requires database" />
        <div className="adm-explain">Connect CockroachDB/Postgres to persist platform settings.</div>
      </div>
    );
  }

  return (
    <div className="adm-page" data-testid="admin-platform-panel">
      <AP.H num="12" title="PLATFORM" sub="URLs · CORS · registration · paid tier" />
      <div className="adm-explain">
        Product configuration formerly spread across environment variables. Changes apply within ~15s on each API process (in-process cache).
        OIDC issuer still requires process restart when the public base URL changes.
      </div>
      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}
      {form && (
        <div className="adm-form-grid">
          <AP.FRow label="Public base URL" hint="Protected links, OIDC default issuer, uptime fallback.">
            <input
              className="adm-inp mono"
              value={form.public_base_url}
              onChange={(e) => setForm({ ...form, public_base_url: e.target.value })}
              placeholder="https://api.example.com"
            />
          </AP.FRow>
          <AP.FRow label="Platform mail domain" hint="Default @domain for signup and MX guidance.">
            <input
              className="adm-inp mono"
              value={form.platform_mail_domain}
              onChange={(e) => setForm({ ...form, platform_mail_domain: e.target.value })}
              placeholder="elvish.email"
            />
          </AP.FRow>
          <AP.FRow label="CORS web origins" hint="Comma-separated browser origins for credentialed /api/* calls.">
            <input
              className="adm-inp mono"
              value={form.web_origins}
              onChange={(e) => setForm({ ...form, web_origins: e.target.value })}
              placeholder="https://app.example.com"
            />
          </AP.FRow>
          <AP.FRow label="Cookie domain" hint="Optional Domain= for split-origin sessions (e.g. .example.com).">
            <input
              className="adm-inp mono"
              value={form.cookie_domain}
              onChange={(e) => setForm({ ...form, cookie_domain: e.target.value })}
            />
          </AP.FRow>
          <AP.FRow label="Registration closed" hint="When on, blocks new signups after the first user exists.">
            <label>
              <input
                type="checkbox"
                checked={form.registration_closed}
                onChange={(e) => setForm({ ...form, registration_closed: e.target.checked })}
              />{" "}
              Close registration
            </label>
          </AP.FRow>
          <AP.FRow label="Paid features" hint="Enables custom domains and SMTP submission for non-admin users.">
            <label>
              <input
                type="checkbox"
                checked={form.paid_features_enabled}
                onChange={(e) => setForm({ ...form, paid_features_enabled: e.target.checked })}
              />{" "}
              Paid tier enabled
            </label>
          </AP.FRow>
          <AP.FRow label="Trust X-Forwarded-For" hint="Only enable behind a trusted reverse proxy.">
            <label>
              <input
                type="checkbox"
                checked={form.trust_forwarded_for}
                onChange={(e) => setForm({ ...form, trust_forwarded_for: e.target.checked })}
              />{" "}
              Use forwarded client IP for rate limits
            </label>
          </AP.FRow>
          <AP.FRow label="Content cache (seconds)" hint="In-process TTL for home.json / posts; 0 disables.">
            <input
              type="number"
              className="adm-inp"
              min={0}
              value={form.content_cache_sec}
              onChange={(e) => setForm({ ...form, content_cache_sec: parseInt(e.target.value, 10) || 0 })}
            />
          </AP.FRow>
          <AP.FRow label="SMTP rate limit / hour" hint="Per connecting IP on MX and submission.">
            <input
              type="number"
              className="adm-inp"
              min={1}
              value={form.smtp_rate_limit_per_hour}
              onChange={(e) => setForm({ ...form, smtp_rate_limit_per_hour: parseInt(e.target.value, 10) || 100 })}
            />
          </AP.FRow>
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save platform settings"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

window.SecPlatform = SecPlatform;
