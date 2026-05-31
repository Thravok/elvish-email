// ELVISH admin — uptime monitoring (SQL-backed settings + run logs)
const A = window.adm;
const { useState: useS_u, useEffect: useE_u } = React;

function SecUptime() {
  const [me, setMe] = useS_u(null);
  const [data, setData] = useS_u(null);
  const [err, setErr] = useS_u("");
  const [msg, setMsg] = useS_u("");
  const [form, setForm] = useS_u({
    enabled: true,
    interval: "5m",
    base_url: "",
    include_tools_from_home: true,
    endpoints: []
  });
  const [saving, setSaving] = useS_u(false);
  const [showClearConfirm, setShowClearConfirm] = useS_u(false);
  const [clearing, setClearing] = useS_u(false);

  useE_u(() => {
    fetch("/api/staff/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMe(j.staff || null))
      .catch(() => setMe(null));
  }, []);

  const load = () => {
    setErr("");
    setMsg("");
    fetch("/api/console/uptime", { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (d.settings) {
          setForm({
            enabled: d.settings.enabled !== false,
            interval: d.settings.interval || "5m",
            base_url: d.settings.base_url || "",
            include_tools_from_home: d.settings.include_tools_from_home !== false,
            endpoints: Array.isArray(d.settings.endpoints) ? d.settings.endpoints.map((x) => ({ ...x })) : []
          });
        }
      })
      .catch((e) => setErr(String(e.message || e)));
  };

  useE_u(() => {
    if (me && me.is_admin) load();
  }, [me]);

  const save = () => {
    setSaving(true);
    setErr("");
    setMsg("");
    fetch("/api/console/uptime", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || String(r.status));
        return j;
      })
      .then(() => {
        setMsg("Saved.");
        load();
      })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setSaving(false));
  };

  const addEndpoint = () => {
    setForm((f) => ({
      ...f,
      endpoints: [...f.endpoints, { id: "check_" + Date.now().toString(36), url: "/", method: "HEAD" }]
    }));
  };

  const setEp = (i, patch) => {
    setForm((f) => {
      const next = f.endpoints.slice();
      next[i] = { ...next[i], ...patch };
      return { ...f, endpoints: next };
    });
  };

  const delEp = (i) => {
    setForm((f) => ({ ...f, endpoints: f.endpoints.filter((_, j) => j !== i) }));
  };

  if (!me) {
    return (
      <>
        <A.H num="11" title="UPTIME" sub="HTTP checks · logs · admin only" />
        <div className="adm-explain"><a href="/login">Log in</a> to manage uptime.</div>
      </>
    );
  }
  if (!me.is_admin) {
    return (
      <>
        <A.H num="11" title="UPTIME" sub="HTTP checks · logs · admin only" />
        <div className="adm-explain">Your account is not an admin. Set <code className="mono">ELVISH_ADMIN_EMAILS</code> or promote the first registered user.</div>
      </>
    );
  }

  const latest = data && data.latest;
  const agg = data && data.aggregate;
  const runs = (data && data.runs) || [];

  return (
    <div data-testid="admin-uptime-panel">
      <A.H num="11" title="UPTIME" sub="in-process probes · SQL logs · public /api/uptime.json" />
      <div className="adm-explain">
        Monitoring is <strong>on by default</strong> (5m). Interval, probe base URL, and <strong>other HTTP checks</strong> below persist in CockroachDB/Postgres when enabled.
        Static rows live in <code className="mono">content/uptime.json</code>; per-tool monitors live under <strong>TOOLS</strong>. Use <strong>other checks</strong> for extra hosts (CDN, Vaultwarden, APIs) that are not a home tool card.
      </div>
      {data && data.note && <div className="readonly-note" style={{ marginBottom: 12 }}>{data.note}</div>}
      {err && <div className="auth-status err" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="auth-status ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <A.Card title="SETTINGS" right={<button type="button" className="btn-sm primary" disabled={saving || !data?.persist} onClick={save}>{saving ? "…" : "▸ save"}</button>}>
        {!data?.persist && <div className="readonly-note" style={{ marginBottom: 12 }}>Save disabled until the database pool is configured.</div>}
        <A.FRow label="Enabled" hint="Turn all HTTP checks off without restarting the server.">
          <A.Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label={form.enabled ? "ON" : "OFF"} />
        </A.FRow>
        <A.FRow label="Interval" req hint="Go duration, e.g. 5m, 10m, 1h (minimum 10s enforced server-side).">
          <A.Input value={form.interval} onChange={(v) => setForm((f) => ({ ...f, interval: v }))} />
        </A.FRow>
        <A.FRow label="Probe base URL" hint="Leave empty to use ELVISH_UPTIME_BASE_URL / listen address fallback.">
          <A.Input value={form.base_url} onChange={(v) => setForm((f) => ({ ...f, base_url: v }))} placeholder="https://your-public-host" />
        </A.FRow>
        <A.FRow label="Include tools from home" hint={"Adds GET/HEAD per tool: default open_href rules else " + "/{slug}/" + "; skipped when a tool has an enabled uptime monitor (that check runs separately). Hidden tools omitted."}>
          <A.Toggle checked={form.include_tools_from_home} onChange={(v) => setForm((f) => ({ ...f, include_tools_from_home: v }))} label={form.include_tools_from_home ? "YES" : "NO"} />
        </A.FRow>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <div className="ftk" style={{ marginBottom: 6 }}>// OTHER MONITORING</div>
          <p className="dim" style={{ fontSize: 11, lineHeight: 1.5, margin: "0 0 10px" }}>
            Arbitrary HTTP targets (HEAD or GET). Each row needs a stable <code className="mono">id</code> (shows on <code className="mono">/status/</code>) and a full URL or a path under the probe base above. Saved with <strong>▸ save</strong>.
          </p>
          <button type="button" className="btn-sm primary" disabled={!data?.persist} onClick={addEndpoint}>+ add check</button>
        </div>
        {form.endpoints.length === 0 && <div className="dim" style={{ marginTop: 10, fontSize: 11 }}>No extra checks — optional.</div>}
        {form.endpoints.map((ep, i) => (
          <div key={i} className="split-3" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <A.FRow label="ID" req hint="Probe key, e.g. cdn_edge or vault_health.">
              <A.Input value={ep.id} onChange={(v) => setEp(i, { id: v })} />
            </A.FRow>
            <A.FRow label="URL or path" req hint="https://… or /path under probe base.">
              <A.Input value={ep.url} onChange={(v) => setEp(i, { url: v })} />
            </A.FRow>
            <A.FRow label="Method">
              <A.Seg value={(ep.method || "HEAD").toUpperCase()} onChange={(v) => setEp(i, { method: v })} options={[{ value: "HEAD", label: "HEAD" }, { value: "GET", label: "GET" }]} />
            </A.FRow>
            <button type="button" className="btn-sm danger" onClick={() => delEp(i)}>remove</button>
          </div>
        ))}
      </A.Card>

      <A.Card title="LIVE SNAPSHOT" right={<button type="button" className="btn-sm" onClick={load}>refresh</button>}>
        {!latest && <div className="dim">No probe completed yet.</div>}
        {latest && (
          <div style={{ fontSize: 12 }}>
            <div><span className="dim">checked_at</span> · {String(latest.checked_at || "")}</div>
            <div style={{ marginTop: 8 }}>
              <span className="dim">monthly (UTC)</span>
              {latest.stats_period_utc ? <span className="dim"> · {latest.stats_period_utc}</span> : null}
              {" "}· {latest.overall_uptime_pct != null ? latest.overall_uptime_pct.toFixed(2) : "—"}%
              {" "}({latest.overall_ok || 0} ok / {(latest.overall_ok || 0) + (latest.overall_fail || 0)} total)
            </div>
            <table className="adm-mini-table" style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
              <thead><tr><th align="left">id</th><th align="left">url</th><th>ok</th><th>ms</th><th>status</th></tr></thead>
              <tbody>
                {(latest.targets || []).map((t) => (
                  <tr key={t.id + t.url}>
                    <td style={{ fontFamily: "var(--mono)" }}>{t.id}</td>
                    <td className="dim" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.url}</td>
                    <td>{t.ok ? "●" : "○"}</td>
                    <td>{t.latency_ms}</td>
                    <td>{t.status_code}{t.error ? <span className="dim"> · {t.error}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </A.Card>

      <A.Card title="THIS MONTH (UTC) · AGGREGATE">
        {!agg && <div className="dim">No aggregate yet (first successful probe with Mongo will create it).</div>}
        {agg && (
          <div style={{ fontSize: 12 }}>
            {agg.period_ym && <div><span className="dim">period_ym</span> · {agg.period_ym}</div>}
            <div><span className="dim">started_at</span> · {agg.started_at || "—"}</div>
            <div><span className="dim">updated_at</span> · {agg.updated_at || "—"}</div>
            <table className="adm-mini-table" style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
              <thead><tr><th align="left">target</th><th>ok</th><th>fail</th><th>%</th></tr></thead>
              <tbody>
                {Object.entries(agg.targets || {}).map(([k, v]) => {
                  const t = v || {};
                  const n = (t.ok || 0) + (t.fail || 0);
                  const pct = n ? ((100 * (t.ok || 0)) / n).toFixed(2) : "—";
                  return (
                    <tr key={k}>
                      <td style={{ fontFamily: "var(--mono)" }}>{t.id || k}</td>
                      <td>{t.ok || 0}</td>
                      <td>{t.fail || 0}</td>
                      <td>{pct}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </A.Card>

      <A.Card
        title="RUN LOG"
        right={
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="dim">newest first</span>
            <button
              type="button"
              className="btn-sm danger"
              disabled={!data?.persist || runs.length === 0}
              title="Deletes all documents in uptime_runs (does not reset monthly counters)"
              onClick={() => setShowClearConfirm(true)}
            >
              clear log
            </button>
          </span>
        }
      >
        {runs.length === 0 && <div className="dim">No runs logged yet.</div>}
        {runs.map((run) => (
          <details key={run._id || run.at} style={{ marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 12 }}>
              <span style={{ color: "var(--accent)" }}>▸</span> {run.at} · {(run.results || []).length} targets
            </summary>
            <table className="adm-mini-table" style={{ width: "100%", marginTop: 8, fontSize: 11, borderCollapse: "collapse" }}>
              <tbody>
                {(run.results || []).map((t, j) => (
                  <tr key={j}>
                    <td>{t.id}</td>
                    <td className="dim" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{t.url}</td>
                    <td>{t.ok ? "ok" : "FAIL"}</td>
                    <td>{t.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </A.Card>

      {showClearConfirm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !clearing) setShowClearConfirm(false); }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--fg)", maxWidth: 420, width: "90%", position: "relative" }}>
            <div style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, background: "var(--accent)" }}></div>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--fg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Confirm Clear</span>
              <button type="button" className="btn-close" onClick={() => setShowClearConfirm(false)} disabled={clearing}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
                Delete all uptime run log entries? This cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-sm" onClick={() => setShowClearConfirm(false)} disabled={clearing}>Cancel</button>
                <button
                  type="button"
                  className="btn-sm danger"
                  disabled={clearing}
                  onClick={() => {
                    setClearing(true);
                    setErr("");
                    setMsg("");
                    fetch("/api/console/uptime/runs", { method: "DELETE", credentials: "include" })
                      .then(async (r) => {
                        const j = await r.json().catch(() => ({}));
                        if (!r.ok) throw new Error(j.error || String(r.status));
                        return j;
                      })
                      .then((j) => {
                        setMsg(`Cleared run log (${j.deleted ?? 0} deleted).`);
                        setShowClearConfirm(false);
                        load();
                      })
                      .catch((e) => setErr(String(e.message || e)))
                      .finally(() => setClearing(false));
                  }}
                >
                  {clearing ? "Clearing..." : "Clear Log"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.SecUptime = SecUptime;
