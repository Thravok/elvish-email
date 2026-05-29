// ELVISH admin — tools, posts, build sections
const A2 = window.adm;
const { useState: useS_a, useMemo: useM_a, useEffect: useE_a, useRef: useR_a } = React;

const TOOL_MONITOR_TYPES = [
  { value: "http", label: "HTTP(S)" },
  { value: "http_keyword", label: "HTTP keyword" },
  { value: "http_json", label: "HTTP JSON" },
  { value: "tcp", label: "TCP" },
  { value: "ping", label: "Ping (TCP open)" },
  { value: "dns", label: "DNS" },
  { value: "websocket", label: "WebSocket (stub)" },
  { value: "push", label: "Push (stub)" }
];

function parseToolMonitorExpectStatus(s) {
  const out = [];
  String(s || "")
    .split(/[\s,]+/)
    .forEach((p) => {
      const n = parseInt(p, 10);
      if (!Number.isNaN(n) && n > 0) out.push(n);
    });
  return out;
}

function ToolMonitorEditor({ row, onChange, onClear }) {
  const set = (patch) => onChange({ ...row, ...patch });
  const t = row.type || "http";
  return (
    <div className="adm-card" style={{ marginTop: 10, borderColor: "var(--line)" }}>
      <div className="adm-card-h">
        <div className="l">UPTIME · {row.name || row.id}</div>
        <div className="r">{typeof onClear === "function" && <button type="button" className="btn-sm danger" onClick={onClear}>remove check</button>}</div>
      </div>
      <div className="adm-card-b">
        <div className="split-2">
          <A2.FRow label="Enabled"><A2.Toggle checked={!!row.enabled} onChange={(v) => set({ enabled: v })} label={row.enabled ? "ON" : "OFF"} /></A2.FRow>
          <A2.FRow label="ID" hint="Stable uuid — do not change after first save.">
            <A2.Input value={row.id} onChange={(v) => set({ id: v.trim() })} />
          </A2.FRow>
        </div>
        <A2.FRow label="Name" req><A2.Input value={row.name} onChange={(v) => set({ name: v })} /></A2.FRow>
        <A2.FRow label="Check type" req hint="How the worker runs this check (stubs are listed but not executed yet).">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TOOL_MONITOR_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                className={"btn-sm" + (t === o.value ? " primary" : "")}
                onClick={() => set({ type: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </A2.FRow>
        {(t === "http" || t === "http_keyword" || t === "http_json") && (
          <>
            <A2.FRow label="URL" req hint="Full https URL for off-site services.">
              <A2.Input value={row.url || ""} onChange={(v) => set({ url: v })} />
            </A2.FRow>
            <div className="split-2">
              <A2.FRow label="Method" hint="GET or HEAD; keyword/json force GET.">
                <A2.Input value={row.method || "GET"} onChange={(v) => set({ method: v.toUpperCase() })} placeholder="GET" />
              </A2.FRow>
              <A2.FRow label="Expect status" hint="Comma list, e.g. 200,204. Empty = any 2xx/3xx.">
                <A2.Input value={(Array.isArray(row.expect_status) ? row.expect_status : []).join(",")} onChange={(v) => set({ expect_status: parseToolMonitorExpectStatus(v) })} placeholder="200" />
              </A2.FRow>
            </div>
            {t === "http_keyword" && (
              <A2.FRow label="Keyword" req hint="Body must contain this substring (first 512 KiB).">
                <A2.Input value={row.keyword || ""} onChange={(v) => set({ keyword: v })} />
              </A2.FRow>
            )}
            {t === "http_json" && (
              <div className="split-2">
                <A2.FRow label="JSON path" req hint="Dot path, e.g. data.status">
                  <A2.Input value={row.json_path || ""} onChange={(v) => set({ json_path: v })} />
                </A2.FRow>
                <A2.FRow label="Expected value" req hint="String match at path.">
                  <A2.Input value={row.json_value || ""} onChange={(v) => set({ json_value: v })} />
                </A2.FRow>
              </div>
            )}
          </>
        )}
        {(t === "tcp" || t === "ping") && (
          <div className="split-2">
            <A2.FRow label="Hostname" req><A2.Input value={row.hostname || ""} onChange={(v) => set({ hostname: v })} /></A2.FRow>
            <A2.FRow label="Port" hint={t === "ping" ? "Default 443 if empty." : "Required for TCP."}>
              <A2.Input value={row.port ? String(row.port) : ""} onChange={(v) => set({ port: parseInt(v, 10) || 0 })} placeholder={t === "ping" ? "443" : "443"} />
            </A2.FRow>
          </div>
        )}
        {t === "dns" && (
          <div className="split-3">
            <A2.FRow label="DNS name" req><A2.Input value={row.dns_name || ""} onChange={(v) => set({ dns_name: v })} /></A2.FRow>
            <A2.FRow label="Record" req hint="A, TXT, or CNAME">
              <A2.Input value={row.dns_record_type || "A"} onChange={(v) => set({ dns_record_type: v.toUpperCase() })} />
            </A2.FRow>
            <A2.FRow label="Expect contains" hint="Substring in joined lookup result.">
              <A2.Input value={row.dns_expected || ""} onChange={(v) => set({ dns_expected: v })} />
            </A2.FRow>
          </div>
        )}
        {(t === "websocket" || t === "push") && (
          <p className="readonly-note" style={{ marginTop: 8 }}>Worker returns not-implemented for now — add HTTP/TCP/DNS rows instead.</p>
        )}
      </div>
    </div>
  );
}

// ====================== TOOLS ======================
function GlyphPicker({ value, onChange }) {
  return (
    <div className="glyph-grid">
      {window.GLYPHS.map(g => (
        <div key={g} className={"glyph-tile" + (value === g ? " on" : "")} onClick={() => onChange(g)}>
          <window.Glyph name={g} />
          <span className="lab">{g}</span>
        </div>
      ))}
    </div>
  );
}

function ToolEditor({ tool, onChange, onClose, onDelete }) {
  const [probeBusy, setProbeBusy] = React.useState(false);
  const [probeOut, setProbeOut] = React.useState(null);
  const [probeErr, setProbeErr] = React.useState("");
  if (!tool || typeof tool !== "object") {
    return (
      <div className="adm-card" style={{ marginTop: 14 }}>
        <div className="adm-card-b"><p className="dim">No tool selected.</p></div>
      </div>
    );
  }
  const rawMon = tool.monitor;
  const mon =
    rawMon != null && typeof rawMon === "object" && !Array.isArray(rawMon) ? rawMon : null;
  const runProbeTest = async () => {
    setProbeErr("");
    setProbeOut(null);
    setProbeBusy(true);
    try {
      const r = await fetch(elvishApiUrl("/api/admin/uptime/test-probe"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: tool.slug,
          open_href: tool.open_href || "",
          monitor: mon
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProbeErr(j.error || "HTTP " + r.status);
        return;
      }
      setProbeOut(j);
    } catch (e) {
      setProbeErr(String(e));
    } finally {
      setProbeBusy(false);
    }
  };
  const addMonitor = () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "m" + Date.now();
    onChange({
      ...tool,
      monitor: {
        id,
        enabled: true,
        name: "UPTIME CHECK",
        type: "http",
        url: "https://",
        method: "GET",
        expect_status: []
      }
    });
  };
  const clearMonitor = () => onChange({ ...tool, monitor: null });
  return (
    <div className="adm-card" style={{ marginTop: 14, borderColor: "var(--accent)" }}>
      <div className="adm-card-h" style={{ background: "rgba(255,87,34,0.06)" }}>
        <div className="l">EDITING · {tool.name || "(unnamed)"}</div>
        <div className="r"><button className="btn-sm" onClick={onClose}>close</button></div>
      </div>
      <div className="adm-card-b">
        <div className="split-3">
          <A2.FRow label="ID" hint="display order, e.g. 01"><A2.Input value={tool.id} onChange={(v) => onChange({ ...tool, id: v })} /></A2.FRow>
          <A2.FRow label="Slug" req hint="url-safe, unique"><A2.Input value={tool.slug} onChange={(v) => onChange({ ...tool, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></A2.FRow>
          <A2.FRow label="Name" req><A2.Input value={tool.name} onChange={(v) => onChange({ ...tool, name: v })} /></A2.FRow>
        </div>
        <A2.FRow label="Description" req><A2.Textarea value={tool.desc} onChange={(v) => onChange({ ...tool, desc: v })} /></A2.FRow>
        <div className="split-2">
          <A2.FRow label="Tag">
            <A2.Seg value={tool.tag} onChange={(v) => onChange({ ...tool, tag: v })}
              options={[{ value: "live", label: "LIVE" }, { value: "beta", label: "BETA" }, { value: "wip", label: "WIP" }]} />
          </A2.FRow>
          <A2.FRow label="Calls" hint={"—, /, live, auto, or empty = live GET /go/slug count; other text is fixed. Toggle below off to always show Calls as written."}>
            <A2.Input value={tool.calls} onChange={(v) => onChange({ ...tool, calls: v })} />
          </A2.FRow>
        </div>
        <div className="split-2" style={{ marginTop: 8 }}>
          <A2.FRow label="Live call count" hint="On: sentinels use Valkey (GET /go/slug only). Off: Calls column is exactly what you type.">
            <A2.Toggle checked={!tool.calls_static} onChange={(v) => onChange({ ...tool, calls_static: !v })} label={tool.calls_static ? "OFF (static)" : "ON (Valkey)"} />
          </A2.FRow>
          <A2.FRow label="Since"><A2.Input value={tool.since} onChange={(v) => onChange({ ...tool, since: v })} /></A2.FRow>
        </div>
        <A2.FRow label="Show on home" hint="When off, the card is hidden from the public grid and skipped by automatic uptime probes for this slug.">
          <A2.Toggle checked={!tool.hidden} onChange={(v) => onChange({ ...tool, hidden: !v })} label={tool.hidden ? "HIDDEN" : "LISTED"} />
        </A2.FRow>
        <div className="adm-probe-box" style={{ marginTop: 14, padding: "12px 14px", border: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
          <div className="adm-subhead" style={{ marginBottom: 8 }}>// LINKS & UPTIME</div>
          <A2.FRow label="Open href" hint="GET /go/&lt;slug&gt;/ redirect for visitors only. Not the uptime probe unless you leave uptime unset below.">
            <A2.Input value={tool.open_href || ""} onChange={(v) => onChange({ ...tool, open_href: v })} placeholder="/shroud/ or https://…" />
          </A2.FRow>
          <A2.FRow
            label="Uptime"
            hint={"DEFAULT = worker HEAD/GET using open href rules, else " + "/{slug}/" + " on the probe base. CUSTOM = one separate check (HTTP variants, TCP, DNS, …)."}
          >
            <A2.Seg
              value={mon ? "custom" : "default"}
              onChange={(v) => {
                if (v === "default") clearMonitor();
                else if (!mon) addMonitor();
              }}
              options={[
                { value: "default", label: "DEFAULT" },
                { value: "custom", label: "CUSTOM" }
              ]}
            />
          </A2.FRow>
          {mon && <ToolMonitorEditor row={mon} onChange={(next) => onChange({ ...tool, monitor: next })} />}
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn-sm" disabled={probeBusy} onClick={runProbeTest}>
              {probeBusy ? "testing…" : "test probe now"}
            </button>
            <span className="dim" style={{ fontSize: 10 }}>Runs this check once from the server (same paths as the worker). Uses uptime/home base URL if unset below.</span>
          </div>
          {probeErr && <div className="readonly-note" style={{ marginTop: 8 }}>{probeErr}</div>}
          {probeOut && probeOut.result && (
            <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--line)", fontSize: 11, fontFamily: "var(--mono)", background: "rgba(0,0,0,0.2)" }}>
              <div><span className="dim">base</span> {probeOut.base_url}</div>
              <div><span className="dim">id</span> {probeOut.result.id} · <span className="dim">ok</span> {String(probeOut.result.ok)} · <span className="dim">ms</span> {probeOut.result.latency_ms} · <span className="dim">status</span> {probeOut.result.status_code || "—"}</div>
              {probeOut.result.method && <div><span className="dim">method</span> {probeOut.result.method}</div>}
              {probeOut.result.url && <div style={{ wordBreak: "break-all" }}><span className="dim">url</span> {probeOut.result.url}</div>}
              {probeOut.result.error && <div style={{ color: "var(--accent)", marginTop: 6 }}>{probeOut.result.error}</div>}
            </div>
          )}
        </div>
        <A2.FRow label="Trust / data signals" hint="Short posture chips on each card (browser-only, no-upload, …).">
          <A2.Chips values={tool.signals ?? tool.stack ?? []} onChange={(v) => onChange({ ...tool, signals: v, stack: undefined })}
            suggestions={["BROWSER-ONLY","NO-UPLOAD","OFFLINE-CAPABLE","OPTIONAL-SYNC","OPEN-SOURCE","NO-ACCOUNT","LOCAL-FIRST"]} />
        </A2.FRow>
        <A2.FRow label="Glyph" req hint="Must be one of the registered glyph keys.">
          <GlyphPicker value={tool.glyph} onChange={(v) => onChange({ ...tool, glyph: v })} />
        </A2.FRow>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button className="btn-sm danger" onClick={onDelete}>delete tool</button>
          <button className="btn-sm primary" onClick={onClose}>save & close</button>
        </div>
      </div>
    </div>
  );
}

function SecTools({ state, set }) {
  const [editIdx, setEditIdx] = useS_a(-1);
  const [q, setQ] = useS_a("");
  const [pendingDel, setPendingDel] = useS_a(null);
  const [pendingBulkDel, setPendingBulkDel] = useS_a(null);
  const [sel, setSel] = useS_a(() => new Set());
  const headSelRef = useR_a(null);
  const M = window.VModals;

  const setTools = (v) => set({ ...state, tools: v });
  const filtered = state.tools.map((t, i) => ({ t, i })).filter(({ t }) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()));

  const allFilteredSelected = filtered.length > 0 && filtered.every(({ i }) => sel.has(i));
  const someFilteredSelected = filtered.some(({ i }) => sel.has(i));

  useE_a(() => {
    const el = headSelRef.current;
    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const toggleSel = (i) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleSelectFiltered = () => {
    const idxs = filtered.map(({ i }) => i);
    setSel((prev) => {
      const next = new Set(prev);
      const allOn = idxs.length > 0 && idxs.every((j) => next.has(j));
      if (allOn) idxs.forEach((j) => next.delete(j));
      else idxs.forEach((j) => next.add(j));
      return next;
    });
  };

  const clearSel = () => setSel(() => new Set());

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= state.tools.length) return;
    const next = state.tools.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setTools(next);
  };

  const dup = (i) => {
    const t = state.tools[i];
    const { monitors: _mon, health_href: _hh, ...baseT } = t;
    const next = state.tools.slice();
    next.splice(i + 1, 0, {
      ...baseT,
      id: "00",
      slug: t.slug + "-copy",
      name: t.name + " (COPY)",
      open_href: t.open_href || "",
      monitor: t.monitor && typeof t.monitor === "object"
        ? {
            ...t.monitor,
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "m" + Date.now()
          }
        : null
    });
    setTools(next);
  };

  const del = (i) => { setTools(state.tools.filter((_, j) => j !== i)); setEditIdx(-1); setSel(() => new Set()); };

  const delMany = (indices) => {
    const sorted = [...new Set(indices)].sort((a, b) => b - a);
    let next = state.tools.slice();
    for (const idx of sorted) next = next.filter((_, j) => j !== idx);
    setTools(next);
    setEditIdx(-1);
    setSel(() => new Set());
  };

  const add = () => {
    const next = [...state.tools, { id: String(state.tools.length + 1).padStart(2, "0"), slug: "new-tool", name: "NEW TOOL", tag: "wip", desc: "Describe what it does.", signals: [], glyph: "shroud", calls: "—", since: "—", open_href: "", hidden: false, calls_static: false, monitor: null }];
    setTools(next);
    setEditIdx(next.length - 1);
  };

  const slugDupes = useM_a(() => {
    const counts = {};
    state.tools.forEach(t => { counts[t.slug] = (counts[t.slug] || 0) + 1; });
    return new Set(Object.entries(counts).filter(([_, n]) => n > 1).map(([s]) => s));
  }, [state.tools]);

  return (<>
    <A2.H num="05" title="TOOLS GRID" sub={`${state.tools.length} tools · CRUD + reorder + multi-select + glyph picker`} />
    <div className="adm-explain">Slugs must be unique and URL-safe. Glyph must be one of the registered keys; new art means extending <code>glyphs.go</code> in the repo. Turn the <code>home</code> toggle off to hide a card from the public index and skip its uptime row. Optional <strong>uptime check</strong> (one per tool) overrides the default <code>tool_&lt;slug&gt;</code> HTTP probe when enabled.</div>

    <A2.Card title="LIBRARY" right={<>
      {sel.size > 0 && (
        <>
          <span className="dim" style={{ fontSize: 10, marginRight: 8, letterSpacing: "0.12em" }}>{sel.size} selected</span>
          <button type="button" className="btn-sm" style={{ marginRight: 6 }} onClick={clearSel}>clear</button>
          <button
            type="button"
            className="btn-sm danger"
            style={{ marginRight: 8 }}
            onClick={() => {
              const indices = [...sel].filter((j) => j >= 0 && j < state.tools.length);
              if (indices.length === 0) return;
              const picked = indices.map((j) => state.tools[j]).filter(Boolean);
              const preview = picked.slice(0, 5).map((x) => x.name || x.slug).join(" · ");
              const extra = picked.length > 5 ? ` (+${picked.length - 5} more)` : "";
              setPendingBulkDel({
                indices,
                target: {
                  name: `Delete ${picked.length} tool${picked.length === 1 ? "" : "s"}`,
                  path: "",
                  detail: (preview || "selected rows") + extra + " · removed from working tools[] until next save."
                }
              });
            }}
          >
            delete selected
          </button>
        </>
      )}
      <input className="inp" style={{ width: 200, marginRight: 8 }} placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn-sm primary" onClick={add}>+ new tool</button>
    </>}>
      <div className="rep" style={{ border: 0 }}>
        <div className="tool-row head">
          <span className="tool-sel" title="Select visible rows">
            <input
              ref={headSelRef}
              type="checkbox"
              aria-label="Select all visible tools"
              checked={allFilteredSelected}
              onChange={toggleSelectFiltered}
            />
          </span>
          <span></span><span>id</span><span>name · slug · desc</span><span>signals</span><span>tag · calls</span><span>home</span><span>glyph</span><span></span>
        </div>
        {filtered.map(({ t, i }) => (
          <div key={i} className={"tool-row" + (editIdx === i ? " editing" : "") + (sel.has(i) ? " selected" : "")}>
            <label className="tool-sel" title="Select for bulk actions" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={sel.has(i)}
                onChange={() => toggleSel(i)}
                aria-label={`Select ${t.name || t.slug}`}
              />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 4 }}>
              <button className="btn-sm" style={{ padding: "1px 4px", fontSize: 9 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn-sm" style={{ padding: "1px 4px", fontSize: 9 }} onClick={() => move(i, 1)} disabled={i === state.tools.length - 1}>↓</button>
            </div>
            <span className="id">{t.id}</span>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{t.name}</div>
              <div style={{ color: slugDupes.has(t.slug) ? "var(--accent)" : "var(--dim)", fontSize: 10 }}>/{t.slug}{slugDupes.has(t.slug) && " · DUPE"}</div>
              <div className="desc dim" style={{ fontSize: 10 }}>{t.desc}</div>
            </div>
            <div className="tag-cell">{(t.signals ?? t.stack ?? []).slice(0, 3).map(s => <span key={s} className="stack-chip" style={{ fontSize: 9 }}>{s}</span>)}{(t.signals ?? t.stack ?? []).length > 3 && <span className="dim" style={{ fontSize: 10 }}>+{(t.signals ?? t.stack ?? []).length - 3}</span>}</div>
            <div>
              <span className={"tag " + t.tag} style={{ fontSize: 9 }}>{t.tag}</span>
              <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>{t.calls}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <A2.Toggle checked={!t.hidden} onChange={(v) => setTools(state.tools.map((x, j) => j === i ? { ...x, hidden: !v } : x))} label={t.hidden ? "off" : "on"} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", color: "var(--accent)" }}>
              <div style={{ width: 28, height: 28 }}><window.Glyph name={t.glyph} /></div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-sm" onClick={() => setEditIdx(editIdx === i ? -1 : i)}>{editIdx === i ? "close" : "edit"}</button>
              <button className="btn-sm" onClick={() => dup(i)}>dup</button>
            </div>
          </div>
        ))}
      </div>
      {editIdx >= 0 && state.tools[editIdx] && (
        <ToolEditor
          tool={state.tools[editIdx]}
          onChange={(t) => setTools(state.tools.map((x, i) => i === editIdx ? t : x))}
          onClose={() => setEditIdx(-1)}
          onDelete={() => {
            const t = state.tools[editIdx];
            setPendingDel({
              index: editIdx,
              target: {
                name: t.name || "TOOL",
                path: "/" + (t.slug || ""),
                detail: "Removes this row from the tools grid in working state."
              }
            });
          }}
        />
      )}
    </A2.Card>
    {M && pendingDel && (
      <M.ConfirmDestroyModal
        open={true}
        onClose={() => setPendingDel(null)}
        phrase="DELETE"
        target={pendingDel.target}
        onConfirm={() => {
          del(pendingDel.index);
          setPendingDel(null);
        }}
      />
    )}
    {M && pendingBulkDel && (
      <M.ConfirmDestroyModal
        open={true}
        onClose={() => setPendingBulkDel(null)}
        phrase="DELETE"
        target={pendingBulkDel.target}
        onConfirm={() => {
          delMany(pendingBulkDel.indices);
        }}
      />
    )}
  </>);
}

// ====================== POSTS ======================
function buildPostMarkdown(post) {
  const isoDate = String(post.date || "").replace(/\./g, "-");
  const tagsYaml = (post.tags && post.tags.length)
    ? "[" + post.tags.map((t) => JSON.stringify(t)).join(", ") + "]"
    : "[]";
  return `---
title: ${JSON.stringify(post.title || "")}
date: ${isoDate}
time: ${post.time || "00:00"}
slug: ${post.slug}
type: ${post.type || "notes"}
tags: ${tagsYaml}
draft: ${post.draft ? "true" : "false"}
---

${post.body || ""}
`;
}

async function publishPostToAPI(post) {
  if (post.draft) {
    throw new Error("Draft posts cannot be saved to the database. Mark the post public first.");
  }
  const body = {
    slug: post.slug,
    body_markdown: buildPostMarkdown({ ...post, draft: false }),
  };
  if ((post.openpgp_sig || "").trim()) body.detached_openpgp_sig = post.openpgp_sig.trim();
  if ((post.minisig || "").trim()) body.detached_minisig = post.minisig.trim();
  const res = await fetch(elvishApiUrl("/api/posts"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "publish failed");
  return j;
}

function PostEditor({ post, metricsPreview, onChange, onClose, onDelete }) {
  const [tab, setTab] = useS_a("write");
  const [pubBusy, setPubBusy] = useS_a(false);
  const [pubMsg, setPubMsg] = useS_a("");
  const setF = (k, v) => onChange({ ...post, [k]: v });
  const mp = metricsPreview || {};
  return (
    <div className="adm-card" style={{ marginTop: 14, borderColor: "var(--accent)" }}>
      <div className="adm-card-h" style={{ background: "rgba(255,87,34,0.06)" }}>
        <div className="l">EDITING · {post.title || "(untitled)"}</div>
        <div className="r" style={{ display: "flex", gap: 6 }}>
          <div className="seg" style={{ marginRight: 8 }}>
            <button className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>WRITE</button>
            <button className={tab === "meta"  ? "on" : ""} onClick={() => setTab("meta")}>META</button>
            <button className={tab === "raw"   ? "on" : ""} onClick={() => setTab("raw")}>RAW</button>
          </div>
          <button className="btn-sm" onClick={onClose}>close</button>
        </div>
      </div>
      <div className="adm-card-b">
        {tab === "write" && (<>
          <div className="split-2">
            <A2.FRow label="Slug" req hint="URL path /log/&lt;slug&gt;/">
              <A2.Input value={post.slug} onChange={(v) => setF("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            </A2.FRow>
            <A2.FRow label="Visibility" hint="draft = hidden from site & feeds">
              <A2.Toggle checked={!post.draft} onChange={(v) => setF("draft", !v)} label={post.draft ? "DRAFT" : "PUBLIC"} />
            </A2.FRow>
          </div>
          <div className="split-2">
            <A2.FRow label="Type" hint="e.g. security, release — used in log chrome">
              <A2.Select value={post.type} onChange={(v) => setF("type", v)}
                options={[{ value: "notes", label: "notes" }, { value: "release", label: "release" }, { value: "essay", label: "essay" }, { value: "security", label: "security" }, { value: "infra", label: "infra" }]} />
            </A2.FRow>
            <A2.FRow label="Tags" hint="drives /log/tags/&lt;tag&gt;/">
              <A2.Chips values={post.tags} onChange={(v) => setF("tags", v)}
                suggestions={["release","essay","security","notes","infra"]} />
            </A2.FRow>
          </div>
          <A2.FRow label="Title" req><A2.Input value={post.title} onChange={(v) => setF("title", v)} /></A2.FRow>
          <A2.FRow label="Body · Markdown" hint="GFM with unsafe HTML allowed by your renderer.">
            <div className="md-editor" style={{ minHeight: 380 }}>
              <textarea value={post.body} onChange={(e) => setF("body", e.target.value)} />
              <div className="md-preview" dangerouslySetInnerHTML={{ __html: A2.mdRender(post.body) }} />
            </div>
          </A2.FRow>
          <hr style={{ margin: "16px 0" }} />
          <div className="dim tiny" style={{ marginBottom: 8 }}>// DETACHED SIGS · API / Mongo (optional; verified server-side on POST /api/posts). Use only one of OpenPGP or minisig per post.</div>
          <A2.FRow label="OpenPGP detached (armored)" hint="Full ASCII block; only one of OpenPGP or minisign.">
            <textarea className="inp" style={{ width: "100%", minHeight: 72, fontFamily: "monospace", fontSize: 10 }} value={post.openpgp_sig || ""} onChange={(e) => setF("openpgp_sig", e.target.value)} placeholder="-----BEGIN PGP SIGNATURE----- …" />
          </A2.FRow>
          <A2.FRow label="Minisig (detached)" hint="Paste full .minisig file; must verify against signing.pub on server.">
            <textarea className="inp" style={{ width: "100%", minHeight: 56, fontFamily: "monospace", fontSize: 10 }} value={post.minisig || ""} onChange={(e) => setF("minisig", e.target.value)} placeholder="untrusted comment: …" />
          </A2.FRow>
        </>)}
        {tab === "meta" && (<>
          <div className="split-3">
            <A2.FRow label="Date" req hint="YYYY.MM.DD or YYYY-MM-DD"><A2.Input value={post.date} onChange={(v) => setF("date", v)} /></A2.FRow>
            <A2.FRow label="Time UTC"><A2.Input value={post.time} onChange={(v) => setF("time", v)} placeholder="HH:MM" /></A2.FRow>
            <A2.FRow label="Filename"><div className="dim mono" style={{ fontSize: 11 }}>content/blog/{post.date.replace(/\./g, "-")}-{post.slug}.md</div></A2.FRow>
          </div>
          <hr style={{ margin: "16px 0" }} />
          <div className="dim tiny" style={{ marginBottom: 10 }}>// METRICS · dynamic overlay (<code>content/blog/metrics.json</code> keyed by slug)</div>
          <div className="split-2" style={{ fontSize: 12 }}>
            <div><span className="dim tiny">BYTES</span><div style={{ marginTop: 4 }}>{mp.bytes || "—"}</div></div>
            <div><span className="dim tiny">REACH</span><div style={{ marginTop: 4 }}>{mp.reach || "—"}</div></div>
          </div>
          <p className="dim" style={{ fontSize: 10, marginTop: 12 }}>Bytes and reach are not edited per-post here; update metrics or front matter at publish time.</p>
        </>)}
        {tab === "raw" && (
          <pre className="yaml-view">{`---
title: ${JSON.stringify(post.title)}
date: ${post.date.replace(/\./g, "-")}
time: ${post.time || ""}
slug: ${post.slug}
type: ${post.type}
tags: [${post.tags.join(", ")}]
draft: ${post.draft ? "true" : "false"}
# bytes / reach → metrics.json or build pipeline
---

${post.body}
${(post.openpgp_sig || "").trim() ? `\n# + detached OpenPGP armored (${(post.openpgp_sig || "").trim().length} chars) → POST /api/posts as detached_openpgp_sig\n` : ""}${(post.minisig || "").trim() ? `\n# + minisig (${(post.minisig || "").trim().length} chars) → POST /api/posts as detached_minisig\n` : ""}`}</pre>
        )}
        {pubMsg && <div className={"auth-status " + (pubMsg.startsWith("Saved") ? "ok" : "err")} style={{ marginTop: 10 }}>{pubMsg}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
          <button className="btn-sm danger" onClick={onDelete}>delete post</button>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn-sm" onClick={() => setF("draft", true)}>save as draft</button>
            <button
              className="btn-sm"
              disabled={pubBusy}
              onClick={async () => {
                setPubBusy(true);
                setPubMsg("");
                try {
                  await publishPostToAPI(post);
                  setPubMsg("Saved to database.");
                } catch (e) {
                  setPubMsg(String(e.message || e));
                }
                setPubBusy(false);
              }}
            >
              {pubBusy ? "…" : "save to database"}
            </button>
            <button className="btn-sm primary" onClick={() => { setF("draft", false); onClose(); }}>publish & close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecPosts({ state, set }) {
  const [editIdx, setEditIdx] = useS_a(-1);
  const [filter, setFilter] = useS_a("all");
  const [q, setQ] = useS_a("");
  const [pendingDel, setPendingDel] = useS_a(null);
  const [migrateBusy, setMigrateBusy] = useS_a(false);
  const [migrateMsg, setMigrateMsg] = useS_a("");
  const M = window.VModals;

  const setPosts = (v) => set({ ...state, posts: v });

  const filtered = state.posts.map((p, i) => ({ p, i })).filter(({ p }) => {
    if (filter === "draft" && !p.draft) return false;
    if (filter === "public" && p.draft) return false;
    if (filter !== "all" && filter !== "draft" && filter !== "public" && !p.tags.includes(filter)) return false;
    if (q && !(p.title + p.slug + p.body).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const add = () => {
    const today = new Date();
    const d = `${String(today.getFullYear()).slice(-2)}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
    const next = [{ date: d, time: "00:00", title: "Untitled", slug: "untitled-" + Date.now().toString(36), type: "notes", tags: [], draft: true, body: "", openpgp_sig: "", minisig: "" }, ...state.posts];
    setPosts(next);
    setEditIdx(0);
  };

  const del = (i) => { setPosts(state.posts.filter((_, j) => j !== i)); setEditIdx(-1); };

  const counts = useM_a(() => ({
    all: state.posts.length,
    draft: state.posts.filter(p => p.draft).length,
    public: state.posts.filter(p => !p.draft).length,
    signed: state.posts.filter(p =>
      !!(p.openpgp_sig || "").trim() || !!(p.minisig || "").trim() || !!(p.signature_kind || "").trim() || p.signed
    ).length
  }), [state.posts]);

  return (<>
    <A2.H num="08" title="BLOG POSTS" sub={`${state.posts.length} posts · ${counts.draft} drafts · ${counts.signed} signed`} />
    <div className="adm-explain">Posts live at <code>content/blog/YYYY-MM-DD-slug.md</code> with YAML front matter. Drafts are excluded from site and feeds. Bytes/reach come from <code>content/blog/metrics.json</code> (slug overlay), not the per-post editor.</div>

    <A2.Card title="POSTS" right={<>
      <button
        type="button"
        className="btn-sm"
        style={{ marginRight: 8 }}
        disabled={migrateBusy}
        onClick={async () => {
          setMigrateBusy(true);
          setMigrateMsg("");
          try {
            const res = await fetch(elvishApiUrl("/api/migrate/posts"), { method: "POST", credentials: "include" });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || "migrate failed");
            setMigrateMsg(`Imported ${j.upserted ?? 0} post(s) from disk. Reload to refresh.`);
          } catch (e) {
            setMigrateMsg(String(e.message || e));
          }
          setMigrateBusy(false);
        }}
      >
        {migrateBusy ? "…" : "import from disk"}
      </button>
      <input className="inp" style={{ width: 200, marginRight: 8 }} placeholder="search title/body…" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn-sm primary" onClick={add}>+ new post</button>
    </>}>
      {migrateMsg && <div className="f-help" style={{ marginBottom: 10 }}>{migrateMsg}</div>}
      <div className="cl-filterbar" style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <span className="tiny dim">FILTER ▸</span>
        {[
          { id: "all",     label: `ALL (${counts.all})` },
          { id: "public",  label: `PUBLIC (${counts.public})` },
          { id: "draft",   label: `DRAFT (${counts.draft})` },
          { id: "release", label: "RELEASE" },
          { id: "essay",   label: "ESSAY" },
          { id: "security",label: "SECURITY" },
          { id: "notes",   label: "NOTES" }
        ].map(f => (
          <span key={f.id} className={"cl-filter" + (filter === f.id ? " on" : "")} onClick={() => setFilter(f.id)}>{f.label}</span>
        ))}
      </div>

      <div className="post-row head">
        <span>date</span><span>title · slug</span><span>tags</span><span>type</span><span>signed</span><span>metrics</span><span></span>
      </div>
      {filtered.map(({ p, i }) => {
        const m = state.metrics[p.slug] || {};
        return (
          <div key={i} className={"post-row" + (p.draft ? " draft" : "") + (editIdx === i ? "" : "")}>
            <div>
              <div style={{ fontWeight: 700 }}>{p.date}</div>
              <div className="dim" style={{ fontSize: 10 }}>{p.time}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ttl">{p.title}{p.draft && <span className="cl-tag" style={{ marginLeft: 8, borderColor: "var(--warn)", color: "var(--warn)", fontSize: 9 }}>DRAFT</span>}</div>
              <div className="dim" style={{ fontSize: 10 }}>/{p.slug}</div>
            </div>
            <div className="tag-cell">{p.tags.map(t => <span key={t} className="cl-tag" style={{ fontSize: 9 }}>{t}</span>)}</div>
            <div className="dim">{p.type}</div>
            <div>{(!!(p.openpgp_sig || "").trim() || !!(p.minisig || "").trim() || (p.signature_kind && p.signature_kind !== "") || p.signed)
              ? <span className="signed" title={p.signature_kind || "local"}>● SIG</span>
              : <span className="unsigned">○ —</span>}</div>
            <div className="dim" style={{ fontSize: 10 }}>{m.bytes || "—"} · {m.reach || "—"}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-sm" onClick={() => setEditIdx(editIdx === i ? -1 : i)}>{editIdx === i ? "close" : "edit"}</button>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--dim)" }}>// no posts match</div>}

      {editIdx >= 0 && state.posts[editIdx] && (
        <PostEditor
          post={state.posts[editIdx]}
          metricsPreview={state.metrics[state.posts[editIdx].slug] || {}}
          onChange={(p) => {
            const old = state.posts[editIdx];
            const newPosts = state.posts.map((x, i) => i === editIdx ? p : x);
            let newMetrics = state.metrics;
            if (old.slug !== p.slug && state.metrics[old.slug]) {
              newMetrics = { ...state.metrics, [p.slug]: state.metrics[old.slug] };
              delete newMetrics[old.slug];
            }
            set({ ...state, posts: newPosts, metrics: newMetrics });
          }}
          onClose={() => setEditIdx(-1)}
          onDelete={() => {
            const p = state.posts[editIdx];
            setPendingDel({
              index: editIdx,
              target: {
                name: p.title || "POST",
                path: "/log/" + (p.slug || "") + "/",
                detail: (p.draft ? "Draft · " : "Public · ") + "removes this entry from working posts."
              }
            });
          }}
        />
      )}
    </A2.Card>

    {M && pendingDel && (
      <M.ConfirmDestroyModal
        open={true}
        onClose={() => setPendingDel(null)}
        phrase="DELETE"
        target={pendingDel.target}
        onConfirm={() => {
          del(pendingDel.index);
          setPendingDel(null);
        }}
      />
    )}

    <A2.Card title="SIGNING · PUBLIC KEY" right={<span className="dim">/signing.pub</span>}>
      <A2.FRow label="Public key file" hint="content/blog/signing.pub → copied to /signing.pub at build">
        <div style={{ display: "flex", gap: 8 }}>
          <input type="file" style={{ display: "none" }} id="pubkey-up" />
          <label htmlFor="pubkey-up" className="btn-sm" style={{ cursor: "pointer" }}>upload .pub</label>
          <span className="dim" style={{ alignSelf: "center", fontSize: 11 }}>signing.pub · uploaded 26.04.28</span>
        </div>
      </A2.FRow>
      <div className="readonly-note">Private key never lives here. Sign offline with <code>elvishsign</code> in trusted environment.</div>
    </A2.Card>
  </>);
}

// ====================== OPENPGP PUBLIC KEYS ======================
function SecSigningPGP() {
  const [keys, setKeys] = useS_a([]);
  const [listErr, setListErr] = useS_a("");
  const [armored, setArmored] = useS_a("");
  const [label, setLabel] = useS_a("");
  const [phase, setPhase] = useS_a("idle");
  const [msg, setMsg] = useS_a("");

  const refresh = () => {
    setListErr("");
    fetch("/pgp/keys.json", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setKeys(Array.isArray(data) ? data : []))
      .catch(() => {
        setKeys([]);
        setListErr("Could not load keys (empty Mongo, or server error).");
      });
  };

  useE_a(() => { refresh(); }, []);

  const upload = async () => {
    setMsg("");
    if (!armored.trim()) {
      setMsg("Paste an armored public key block (BEGIN PGP PUBLIC KEY BLOCK).");
      return;
    }
    if (/BEGIN PGP PRIVATE KEY/i.test(armored) || /BEGIN PRIVATE KEY/i.test(armored)) {
      setMsg("Private key blocks are rejected.");
      return;
    }
    setPhase("uploading");
    try {
      const res = await fetch(elvishApiUrl("/api/pgp/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ armored: armored.trim(), label: label.trim() })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("idle");
        setMsg(j.error || "upload failed");
        return;
      }
      setPhase("ok");
      setArmored("");
      setLabel("");
      setMsg("Stored · fingerprint " + (j.fingerprint16 || ""));
      refresh();
      setTimeout(() => setPhase("idle"), 1500);
    } catch (e) {
      setPhase("idle");
      setMsg("network error");
    }
  };

  return (<>
    <A2.H num="09" title="OPENPGP · PUBLIC KEYS" sub="armored upload · verify log posts" />
    <div className="adm-explain">
      Keys are stored in CockroachDB and published at <code className="mono">/pgp/keys.json</code> and <code className="mono">/pgp/key/&lt;fp16&gt;.asc</code>.
      Upload requires an <a href="/login">admin</a> session. Import disk posts with <code className="mono">go run ./cmd/elvishapi -root . -migrate</code> or <code className="mono">POST /api/migrate/posts</code> as admin.
    </div>

    <A2.Card title="INSTALLED KEYS" right={<button type="button" className="btn-sm" onClick={refresh}>refresh</button>}>
      {listErr && <div className="readonly-note" style={{ marginBottom: 10 }}>{listErr}</div>}
      {keys.length === 0 && !listErr && <div className="dim">No keys yet.</div>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {keys.map((k) => (
          <li key={k.fingerprint16} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0", fontSize: 12 }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{k.fingerprint16}</span>
            {k.label && <span className="dim" style={{ marginLeft: 10 }}>{k.label}</span>}
            <div className="dim mono" style={{ marginTop: 4, fontSize: 11 }}>
              <a href={k.url} style={{ color: "var(--accent)" }}>{k.url}</a>
            </div>
          </li>
        ))}
      </ul>
    </A2.Card>

    <A2.Card title="UPLOAD ARMORED PUBLIC KEY">
      <A2.FRow label="Label" hint="optional note"><A2.Input value={label} onChange={setLabel} placeholder="e.g. laptop primary" /></A2.FRow>
      <A2.FRow label="Armored key" req hint="BEGIN PGP PUBLIC KEY BLOCK … END PGP PUBLIC KEY BLOCK">
        <A2.Textarea value={armored} onChange={setArmored} tall placeholder={"-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----"} />
      </A2.FRow>
      {msg && <div className={"auth-status " + (phase === "ok" ? "ok" : "err")} style={{ marginTop: 8 }}>{msg}</div>}
      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn-sm primary" disabled={phase === "uploading"} onClick={upload}>
          {phase === "uploading" ? "…" : "▸ upload to server"}
        </button>
      </div>
    </A2.Card>
  </>);
}

window.SecTools = SecTools;
window.SecPosts = SecPosts;
window.SecSigningPGP = SecSigningPGP;
