// ELVISH admin — anonymous operational telemetry
const AT = window.adm;
const { useState: useS_t, useEffect: useE_t } = React;

function SecTelemetry() {
  const [me, setMe] = useS_t(null);
  const [data, setData] = useS_t(null);
  const [err, setErr] = useS_t("");
  const [msg, setMsg] = useS_t("");
  const [saving, setSaving] = useS_t(false);
  const [exporting, setExporting] = useS_t(false);
  const [exportDays, setExportDays] = useS_t("30");
  const [form, setForm] = useS_t({
    enabled: false,
    retention_days: 30,
    export_enabled: true
  });

  useE_t(() => {
    fetch(elvishApiUrl("/api/auth/me"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMe(j.user || null))
      .catch(() => setMe(null));
  }, []);

  const load = () => {
    setErr("");
    setMsg("");
    fetch(elvishApiUrl("/api/admin/telemetry"), { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (d.settings) {
          setForm({
            enabled: d.settings.enabled === true,
            retention_days: Number(d.settings.retention_days || 30),
            export_enabled: d.settings.export_enabled !== false
          });
          setExportDays(String(d.settings.retention_days || 30));
        }
      })
      .catch((e) => setErr(String(e.message || e)));
  };

  useE_t(() => {
    if (me && me.is_admin) load();
  }, [me]);

  const save = () => {
    setSaving(true);
    setErr("");
    setMsg("");
    fetch(elvishApiUrl("/api/admin/telemetry"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !!form.enabled,
        retention_days: Number(form.retention_days || 30),
        export_enabled: !!form.export_enabled
      })
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

  const downloadExport = async () => {
    setExporting(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch(elvishApiUrl("/api/admin/telemetry/export"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(exportDays || 30) })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || String(r.status));
      }
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = (m && m[1]) || "elvish-telemetry-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg("Export downloaded.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setExporting(false);
    }
  };

  if (!me) {
    return (
      <>
        <AT.H num="07" title="TELEMETRY" sub="anonymous operational rollups · admin only" />
        <div className="adm-explain"><a href="/login">Log in</a> to manage telemetry.</div>
      </>
    );
  }
  if (!me.is_admin) {
    return (
      <>
        <AT.H num="07" title="TELEMETRY" sub="anonymous operational rollups · admin only" />
        <div className="adm-explain">Your account is not an admin. Promote your user in the Users section (first registrant is admin by default).</div>
      </>
    );
  }

  const summary = (data && data.summary) || [];
  const recent = (data && data.recent) || [];

  return (
    <div data-testid="admin-telemetry-panel">
      <AT.H num="07" title="TELEMETRY" sub="opt-in · aggregate-only · no identifiers" />
      <div className="adm-explain">
        Telemetry is <strong>off by default</strong>. When enabled, the server stores only coarse operational rollups such as request outcomes, background job runtimes, and delivery health.
        It does <strong>not</strong> persist user IDs, emails, IPs, message IDs, raw paths, domains, or any unique identifier. Export is manual only.
      </div>
      {data && data.note && <div className="readonly-note" style={{ marginBottom: 12 }}>{data.note}</div>}
      {err && <div className="auth-status err" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="auth-status ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <AT.Card title="SETTINGS" right={<button type="button" className="btn-sm primary" disabled={saving || !data?.persist} onClick={save}>{saving ? "…" : "▸ save"}</button>}>
        {!data?.persist && <div className="readonly-note" style={{ marginBottom: 12 }}>Save disabled until the database pool is configured.</div>}
        <AT.FRow label="Enabled" hint="Opt in to local anonymous operational telemetry for this instance.">
          <AT.Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label={form.enabled ? "ON" : "OFF"} />
        </AT.FRow>
        <AT.FRow label="Retention (days)" req hint="Hourly aggregates kept in Cockroach/Postgres. Bounded to a short rolling window.">
          <AT.Input value={String(form.retention_days || 30)} onChange={(v) => setForm((f) => ({ ...f, retention_days: Number(v || 30) }))} />
        </AT.FRow>
        <AT.FRow label="Manual export" hint="Allow admins to download a bounded aggregate JSON report for optional sharing later.">
          <AT.Toggle checked={form.export_enabled} onChange={(v) => setForm((f) => ({ ...f, export_enabled: v }))} label={form.export_enabled ? "ON" : "OFF"} />
        </AT.FRow>
      </AT.Card>

      <AT.Card title="MANUAL EXPORT" right={<button type="button" className="btn-sm" disabled={exporting || !data?.persist || !form.export_enabled} onClick={downloadExport}>{exporting ? "…" : "download json"}</button>}>
        <AT.FRow label="Window" hint="Export bounded aggregate rollups only.">
          <AT.Seg value={String(exportDays)} onChange={(v) => setExportDays(String(v))} options={[
            { value: "7", label: "7D" },
            { value: "30", label: "30D" },
            { value: "90", label: "90D" }
          ]} />
        </AT.FRow>
      </AT.Card>

      <AT.Card title="SUMMARY · LAST 7 DAYS">
        {summary.length === 0 && <div className="dim">No telemetry summary yet.</div>}
        {summary.length > 0 && (
          <table className="adm-mini-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th align="left">metric</th>
                <th align="left">area</th>
                <th align="left">result</th>
                <th align="left">status</th>
                <th align="left">transport</th>
                <th>count</th>
                <th>avg ms</th>
                <th>max ms</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => (
                <tr key={row.metric_name + row.feature_area + row.result + row.status_class + row.transport + i}>
                  <td style={{ fontFamily: "var(--mono)" }}>{row.metric_name}</td>
                  <td>{row.feature_area}</td>
                  <td>{row.result}</td>
                  <td>{row.status_class}</td>
                  <td>{row.transport}</td>
                  <td>{row.count || 0}</td>
                  <td>{row.avg_ms != null ? Number(row.avg_ms).toFixed(1) : "—"}</td>
                  <td>{row.max_ms || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AT.Card>

      <AT.Card title="RECENT HOURLY ROLLUPS" right={<button type="button" className="btn-sm" onClick={load}>refresh</button>}>
        {recent.length === 0 && <div className="dim">No recent rollups yet.</div>}
        {recent.length > 0 && (
          <table className="adm-mini-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th align="left">bucket</th>
                <th align="left">metric</th>
                <th align="left">area</th>
                <th align="left">result</th>
                <th align="left">status</th>
                <th align="left">transport</th>
                <th>count</th>
                <th>sum ms</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row, i) => (
                <tr key={row.bucket_start + row.metric_name + row.feature_area + i}>
                  <td className="dim">{row.bucket_start}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{row.metric_name}</td>
                  <td>{row.feature_area}</td>
                  <td>{row.result}</td>
                  <td>{row.status_class}</td>
                  <td>{row.transport}</td>
                  <td>{row.count || 0}</td>
                  <td>{row.sum_ms || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AT.Card>
    </div>
  );
}

window.SecTelemetry = SecTelemetry;
