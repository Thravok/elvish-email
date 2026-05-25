// ELVISH admin — privacy-preserving performance suite
const AP = window.adm;
const { useState: useS_p, useEffect: useE_p, useMemo: useM_p } = React;

const PERF_WINDOWS = [
  { value: "1", label: "24H" },
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
];

const PERF_SCOPES = [
  { value: "all", label: "ALL" },
  { value: "backend", label: "BACKEND" },
  { value: "mail", label: "MAIL" },
  { value: "auth", label: "AUTH" },
  { value: "admin", label: "ADMIN" },
  { value: "public", label: "PUBLIC" },
];

function perfNum(value) {
  return Number(value || 0).toLocaleString();
}

function perfMS(value) {
  const n = Number(value || 0);
  if (!n) return "0 ms";
  if (n >= 1000) return (n / 1000).toFixed(2) + " s";
  return n.toFixed(0) + " ms";
}

function perfPct(value) {
  const n = Number(value || 0);
  return (n * 100).toFixed(1) + "%";
}

function perfBucketLabel(name) {
  return ({
    "lt_50ms": "<50ms",
    "ms_50_99": "50-99ms",
    "ms_100_249": "100-249ms",
    "ms_250_499": "250-499ms",
    "ms_500_999": "500-999ms",
    "ms_1000_1999": "1-2s",
    "ms_2000_4999": "2-5s",
    "ms_5000_9999": "5-10s",
    "ms_10000_plus": "10s+",
  })[name] || name;
}

function perfScopeFor(featureArea, transport) {
  const area = String(featureArea || "").toLowerCase();
  const tx = String(transport || "").toLowerCase();
  if (area === "admin_ui" || area === "admin_api") return "admin";
  if (area === "auth_ui" || area === "auth_api") return "auth";
  if (area === "home" || area === "public_page" || area === "site_api" || area === "static_asset") return "public";
  if (
    area.includes("mail") ||
    area.includes("smtp") ||
    area.includes("outbox") ||
    area.includes("protected_link")
  ) return "mail";
  if (tx === "browser") return "public";
  return "backend";
}

function perfMatchesScope(featureArea, transport, scope) {
  if (scope === "all") return true;
  if (scope === "backend") return String(transport || "").toLowerCase() !== "browser";
  return perfScopeFor(featureArea, transport) === scope;
}

function buildOverview(summaryRows, latencyRows, queue, uptime) {
  const out = {
    totalCount: 0,
    failureCount: 0,
    avgMS: 0,
    maxMS: 0,
    slowCount: 0,
    queuePending: Number(queue && queue.pending || 0),
    queueSending: Number(queue && queue.sending || 0),
    uptimePct: Number(uptime && uptime.overall_uptime_pct || 0),
  };
  let sumMS = 0;
  for (const row of summaryRows) {
    if (row.metric_name === "queue_health") continue;
    out.totalCount += Number(row.count || 0);
    if (row.result && row.result !== "success" && row.result !== "observed") {
      out.failureCount += Number(row.count || 0);
    }
    sumMS += Number(row.sum_ms || 0);
    out.maxMS = Math.max(out.maxMS, Number(row.max_ms || 0));
  }
  for (const row of latencyRows) {
    if (row.latency_bucket === "ms_2000_4999" || row.latency_bucket === "ms_5000_9999" || row.latency_bucket === "ms_10000_plus") {
      out.slowCount += Number(row.count || 0);
    }
  }
  if (out.totalCount > 0) out.avgMS = sumMS / out.totalCount;
  return out;
}

function buildLatencyTrend(rows) {
  const buckets = new Map();
  for (const row of rows) {
    if (row.metric_name === "queue_health") continue;
    const hour = String(row.bucket_start || "");
    if (!hour) continue;
    const entry = buckets.get(hour) || { bucket: hour, browserSum: 0, browserCount: 0, backendSum: 0, backendCount: 0 };
    if (String(row.transport || "").toLowerCase() === "browser") {
      entry.browserSum += Number(row.sum_ms || 0);
      entry.browserCount += Number(row.count || 0);
    } else {
      entry.backendSum += Number(row.sum_ms || 0);
      entry.backendCount += Number(row.count || 0);
    }
    buckets.set(hour, entry);
  }
  return Array.from(buckets.values())
    .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
    .map((row) => ({
      bucket: row.bucket,
      browser: row.browserCount ? row.browserSum / row.browserCount : 0,
      backend: row.backendCount ? row.backendSum / row.backendCount : 0,
    }));
}

function buildFailureTrend(rows) {
  const buckets = new Map();
  for (const row of rows) {
    if (row.metric_name === "queue_health") continue;
    const hour = String(row.bucket_start || "");
    if (!hour) continue;
    const entry = buckets.get(hour) || { bucket: hour, total: 0, failures: 0 };
    entry.total += Number(row.count || 0);
    if (row.result && row.result !== "success" && row.result !== "observed") {
      entry.failures += Number(row.count || 0);
    }
    buckets.set(hour, entry);
  }
  return Array.from(buckets.values())
    .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
    .map((row) => ({
      bucket: row.bucket,
      failureRate: row.total ? row.failures / row.total : 0,
      failures: row.failures,
    }));
}

function buildLatencyBuckets(rows) {
  const order = ["lt_50ms", "ms_50_99", "ms_100_249", "ms_250_499", "ms_500_999", "ms_1000_1999", "ms_2000_4999", "ms_5000_9999", "ms_10000_plus"];
  const counts = {};
  for (const key of order) counts[key] = 0;
  for (const row of rows) {
    counts[row.latency_bucket] = (counts[row.latency_bucket] || 0) + Number(row.count || 0);
  }
  return order.map((key) => ({ key, label: perfBucketLabel(key), count: counts[key] || 0 }));
}

function PerfLineChart({ title, points, keys }) {
  if (!points.length) return <div className="dim">No data for this filter.</div>;
  const width = 720;
  const height = 180;
  const pad = 18;
  const maxY = Math.max(1, ...points.flatMap((point) => keys.map((key) => Number(point[key.id] || 0))));
  const stepX = points.length <= 1 ? width - pad * 2 : (width - pad * 2) / (points.length - 1);
  const mkLine = (id) => points.map((point, idx) => {
    const value = Number(point[id] || 0);
    const x = pad + idx * stepX;
    const y = height - pad - ((height - pad * 2) * value / maxY);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="perf-chart-wrap">
      <div className="perf-chart-title">{title}</div>
      <svg className="perf-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="perf-axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="perf-axis" />
        {keys.map((key) => (
          <polyline key={key.id} fill="none" stroke={key.color} strokeWidth="2.5" points={mkLine(key.id)} />
        ))}
      </svg>
      <div className="perf-legend">
        {keys.map((key) => (
          <span key={key.id}><span className="perf-legend-dot" style={{ background: key.color }}></span>{key.label}</span>
        ))}
      </div>
      <div className="perf-chart-labels">
        <span>{String(points[0].bucket || "").slice(5, 16)}</span>
        <span>{String(points[points.length - 1].bucket || "").slice(5, 16)}</span>
      </div>
    </div>
  );
}

function PerfBarChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  if (!rows.length) return <div className="dim">No latency buckets yet.</div>;
  return (
    <div className="perf-bars">
      {rows.map((row) => (
        <div key={row.key} className="perf-bar-row">
          <span className="perf-bar-label">{row.label}</span>
          <div className="perf-bar-track"><span className="perf-bar-fill" style={{ width: `${(row.count / max) * 100}%` }}></span></div>
          <span className="perf-bar-value">{perfNum(row.count)}</span>
        </div>
      ))}
    </div>
  );
}

function SecPerformance() {
  const [me, setMe] = useS_p(null);
  const [data, setData] = useS_p(null);
  const [err, setErr] = useS_p("");
  const [msg, setMsg] = useS_p("");
  const [days, setDays] = useS_p("1");
  const [scope, setScope] = useS_p("all");
  const [loading, setLoading] = useS_p(false);
  const [exporting, setExporting] = useS_p(false);

  useE_p(() => {
    fetch(elvishApiUrl("/api/auth/me"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMe(j.user || null))
      .catch(() => setMe(null));
  }, []);

  const load = () => {
    setLoading(true);
    setErr("");
    setMsg("");
    fetch(elvishApiUrl(`/api/admin/performance?days=${encodeURIComponent(days)}`), { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) throw new Error("admin login required");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => setData(j))
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  useE_p(() => {
    if (me && me.is_admin) load();
  }, [me, days]);

  const downloadExport = async () => {
    const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    setExporting(true);
    setErr("");
    setMsg("");
    try {
      const r = await fetch(elvishApiUrl("/api/admin/performance/export"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days || 7) }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || String(r.status));
      }
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = r.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = (match && match[1]) || "elvish-performance-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg("Export downloaded.");
      if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "export_action", perfStartedAt, "success");
    } catch (e) {
      setErr(String(e.message || e));
      if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "export_action", perfStartedAt, "failure");
    } finally {
      setExporting(false);
    }
  };

  const summary = useM_p(() => ((data && data.summary) || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
  const recent = useM_p(() => ((data && data.recent) || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
  const latencySummary = useM_p(() => ((data && data.latency_summary) || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
  const hotspots = useM_p(() => ((data && data.hotspots) || []).filter((row) => perfMatchesScope(row.feature_area, row.transport, scope)), [data, scope]);
  const queue = data && data.queue ? data.queue : {};
  const uptime = data && data.uptime ? data.uptime : {};
  const overview = useM_p(() => buildOverview(summary, latencySummary, queue, uptime), [summary, latencySummary, queue, uptime]);
  const latencyTrend = useM_p(() => buildLatencyTrend(recent), [recent]);
  const failureTrend = useM_p(() => buildFailureTrend(recent), [recent]);
  const latencyBuckets = useM_p(() => buildLatencyBuckets(latencySummary), [latencySummary]);

  if (!me) {
    return (
      <div data-testid="admin-performance-panel">
        <AP.H num="08" title="PERFORMANCE" sub="privacy-safe dashboard · admin only" />
        <div className="adm-explain"><a href="/login">Log in</a> to inspect performance.</div>
      </div>
    );
  }
  if (!me.is_admin) {
    return (
      <div data-testid="admin-performance-panel">
        <AP.H num="08" title="PERFORMANCE" sub="privacy-safe dashboard · admin only" />
        <div className="adm-explain">Your account is not an admin. Promote your user in the Users section (first registrant is admin by default).</div>
      </div>
    );
  }

  return (
    <div data-testid="admin-performance-panel">
      <AP.H num="08" title="PERFORMANCE" sub="aggregate-only · manual export · no identifiers" />
      <div className="adm-explain">
        This dashboard extends anonymous telemetry with bounded latency buckets and browser beacons. It keeps the same privacy contract:
        no user IDs, emails, IPs, raw URLs, domains, message IDs, search text, or free-form labels. Export is manual and bounded.
      </div>
      {data && data.note && <div className="readonly-note" style={{ marginBottom: 12 }}>{data.note}</div>}
      {err && <div className="auth-status err" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="auth-status ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <AP.Card title="FILTERS" right={<button type="button" className="btn-sm" onClick={load}>{loading ? "…" : "refresh"}</button>}>
        <div className="perf-filter-grid">
          <AP.FRow label="Window">
            <AP.Seg value={days} onChange={setDays} options={PERF_WINDOWS} />
          </AP.FRow>
          <AP.FRow label="Surface">
            <AP.Seg value={scope} onChange={setScope} options={PERF_SCOPES} />
          </AP.FRow>
        </div>
      </AP.Card>

      <div className="perf-kpis">
        <div className="stat"><span>events</span><strong>{perfNum(overview.totalCount)}</strong></div>
        <div className="stat"><span>failure rate</span><strong>{overview.totalCount ? perfPct(overview.failureCount / overview.totalCount) : "0.0%"}</strong></div>
        <div className="stat"><span>avg latency</span><strong>{perfMS(overview.avgMS)}</strong></div>
        <div className="stat"><span>max latency</span><strong>{perfMS(overview.maxMS)}</strong></div>
        <div className="stat"><span>slow 2s+</span><strong>{perfNum(overview.slowCount)}</strong></div>
        <div className="stat"><span>uptime</span><strong>{uptime && uptime.live ? (Number(uptime.overall_uptime_pct || 0).toFixed(2) + "%") : "—"}</strong></div>
      </div>

      <div className="perf-grid">
        <AP.Card title="LATENCY TREND">
          <PerfLineChart
            title="hourly average latency"
            points={latencyTrend}
            keys={[
              { id: "browser", label: "browser", color: "var(--accent)" },
              { id: "backend", label: "backend", color: "var(--ok)" },
            ]}
          />
        </AP.Card>

        <AP.Card title="FAILURE TREND">
          <PerfLineChart
            title="hourly failure rate"
            points={failureTrend}
            keys={[{ id: "failureRate", label: "failure rate", color: "var(--warn)" }]}
          />
        </AP.Card>

        <AP.Card title="LATENCY BUCKETS">
          <PerfBarChart rows={latencyBuckets} />
        </AP.Card>

        <AP.Card
          title="QUEUE / EXPORT"
          right={<button type="button" className="btn-sm primary" disabled={exporting || !(data && data.persist)} onClick={downloadExport}>{exporting ? "…" : "download json"}</button>}
        >
          <div className="perf-queue">
            <div><span className="dim">pending</span><strong>{perfNum(queue.pending)}</strong></div>
            <div><span className="dim">sending</span><strong>{perfNum(queue.sending)}</strong></div>
            <div><span className="dim">sent</span><strong>{perfNum(queue.sent)}</strong></div>
            <div><span className="dim">failed</span><strong>{perfNum(queue.failed)}</strong></div>
          </div>
          <div className="dim" style={{ marginTop: 12, fontSize: 11 }}>
            Export includes only aggregate KPIs, hourly rollups, latency buckets, hotspot summaries, queue totals, and safe runtime context.
            Admin-only diagnostics like raw probe URLs stay out of the bundle.
          </div>
        </AP.Card>
      </div>

      <AP.Card title="HOTSPOTS">
        {hotspots.length === 0 ? <div className="dim">No hotspots yet.</div> : (
          <table className="adm-mini-table perf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">metric</th>
                <th align="left">area</th>
                <th align="left">operation</th>
                <th align="left">transport</th>
                <th>count</th>
                <th>failure</th>
                <th>avg ms</th>
                <th>max ms</th>
              </tr>
            </thead>
            <tbody>
              {hotspots.map((row, idx) => (
                <tr key={`${row.metric_name || row.metricName}-${row.feature_area || row.featureArea}-${idx}`}>
                  <td className="mono">{row.metric_name || row.metricName}</td>
                  <td>{row.feature_area || row.featureArea}</td>
                  <td>{row.status_class || row.statusClass}</td>
                  <td>{row.transport}</td>
                  <td>{perfNum(row.count)}</td>
                  <td>{perfPct(row.failure_rate || row.failureRate || 0)}</td>
                  <td>{perfMS(row.avg_ms || row.avgMS)}</td>
                  <td>{perfMS(row.max_ms || row.maxMS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AP.Card>

      <AP.Card title="RAW HOURLY ROLLUPS">
        {recent.length === 0 ? <div className="dim">No rollups for this filter.</div> : (
          <table className="adm-mini-table perf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">bucket</th>
                <th align="left">metric</th>
                <th align="left">area</th>
                <th align="left">result</th>
                <th align="left">operation</th>
                <th align="left">transport</th>
                <th>count</th>
                <th>avg ms</th>
                <th>max ms</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 80).map((row, idx) => (
                <tr key={`${row.bucket_start}-${row.metric_name}-${idx}`}>
                  <td className="dim">{row.bucket_start}</td>
                  <td className="mono">{row.metric_name}</td>
                  <td>{row.feature_area}</td>
                  <td>{row.result}</td>
                  <td>{row.status_class}</td>
                  <td>{row.transport}</td>
                  <td>{perfNum(row.count)}</td>
                  <td>{row.count ? perfMS((Number(row.sum_ms || 0) / Number(row.count || 1))) : "0 ms"}</td>
                  <td>{perfMS(row.max_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AP.Card>
    </div>
  );
}

window.SecPerformance = SecPerformance;
