// ELVISH — tool card + grid
const { useState: useState_tg, useEffect: useEffect_tg, useRef: useRef_tg, useCallback: useCallback_tg } = React;

function formatToolCallCount(n) {
  if (n < 0) n = 0;
  if (n >= 1_000_000) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/** Mirrors httpserver.callsUsesLiveCounter (sentinels → Valkey-backed label on home). */
function callsUsesLiveCounter(s) {
  const t = (s ?? "").trim();
  if (t === "") return true;
  if (t === "/") return true;
  const lower = t.toLowerCase();
  if (lower === "live" || lower === "auto") return true;
  const chars = [...t];
  if (chars.length === 1) {
    const ch = chars[0];
    if (ch === "\u2014" || ch === "\u2013" || ch === "-") return true;
  }
  return false;
}

function ToolCard({ tool, index, focused, onFocus, onOpen, callLabel }) {
  const [hover, setHover] = useState_tg(false);
  const ref = useRef_tg(null);
  const active = hover || focused;

  useEffect_tg(() => {
    if (focused && ref.current) {
      ref.current.focus({ preventScroll: false });
    }
  }, [focused]);

  return (
    <article
      ref={ref}
      tabIndex={0}
      className={"tool-card" + (active ? " active" : "")}
      onMouseEnter={() => { setHover(true); onFocus && onFocus(index); }}
      onMouseLeave={() => setHover(false)}
      onFocus={() => onFocus && onFocus(index)}
      onClick={() => onOpen && onOpen(tool)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(tool); }}
    >
      {/* corner brackets */}
      <span className="cb tl"></span>
      <span className="cb tr"></span>
      <span className="cb bl"></span>
      <span className="cb br"></span>

      <header className="tc-head">
        <div className="tc-head-l">
          <span className="tc-id">{tool.id}</span>
          <span className="tc-slash">/</span>
          <span className="tc-name">{tool.name}</span>
        </div>
        <span className={"tag " + tool.tag}>{tool.tag}</span>
      </header>

      <div className="tc-body">
        <div className="tc-glyph">
          <Glyph name={tool.glyph} />
          <div className="tc-glyph-overlay">
            <div className="ovl-line" style={{ animationDelay: "0ms" }} />
            <div className="ovl-line" style={{ animationDelay: "60ms" }} />
            <div className="ovl-line" style={{ animationDelay: "120ms" }} />
            <div className="ovl-line" style={{ animationDelay: "180ms" }} />
          </div>
          <div className="tc-coords">
            <span>x:{tool.id}</span>
            <span>y:{tool.since}</span>
          </div>
        </div>

        <p className="tc-desc">{tool.desc}</p>

        <div className="tc-stack">
          {(tool.signals ?? tool.stack ?? []).map(s => <span key={s} className="stack-chip">{s}</span>)}
        </div>

        <hr/>

        <div className="tc-foot">
          <span className="dim tiny">CALLS · {callLabel}</span>
          <span className="tc-launch">
            <span>OPEN</span>
            <span className="arr">→</span>
          </span>
        </div>
      </div>
    </article>
  );
}

function ToolsGrid({ query }) {
  const [focusIdx, setFocusIdx] = useState_tg(-1);
  const [serverLive, setServerLive] = useState_tg(false);
  const [counts, setCounts] = useState_tg(() => ({}));
  const filteredRef = useRef_tg([]);
  const focusIdxRef = useRef_tg(-1);

  const refreshCounts = useCallback_tg(async () => {
    try {
      const res = await fetch(elvishApiUrl("/api/tools/calls"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;
      if (data.live && data.counts && typeof data.counts === "object") {
        setServerLive(true);
        setCounts(data.counts);
      } else {
        setServerLive(false);
        setCounts({});
      }
    } catch {
      setServerLive(false);
      setCounts({});
    }
  }, []);

  useEffect_tg(() => {
    refreshCounts();
  }, [refreshCounts]);

  const filtered = TOOLS.filter((t) => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return true;
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.slug && t.slug.toLowerCase().includes(q)) ||
      (t.desc && t.desc.toLowerCase().includes(q)) ||
      ((t.signals ?? t.stack ?? []).join(" ").toLowerCase().includes(q))
    );
  });
  filteredRef.current = filtered;
  focusIdxRef.current = focusIdx;

  const callLabelFor = useCallback_tg((tool) => {
    const staticText = (tool.calls != null && tool.calls !== "") ? String(tool.calls) : "—";
    if (tool.calls_static) {
      return staticText.trim();
    }
    if (!callsUsesLiveCounter(tool.calls)) {
      return staticText.trim();
    }
    if (!serverLive) {
      return "—";
    }
    const raw = counts[tool.slug];
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) {
      return formatToolCallCount(n);
    }
    return formatToolCallCount(0);
  }, [counts, serverLive]);

  const handleOpen = useCallback_tg((t) => {
    const el = document.querySelector(".tool-card.active");
    if (el) {
      el.classList.add("launching");
      setTimeout(() => el.classList.remove("launching"), 600);
    }
    const slug = String(t.slug || "").trim().replace(/^\/+|\/+$/g, "");
    if (slug) {
      window.open("/go/" + slug + "/", "_blank", "noopener,noreferrer");
      setTimeout(() => { refreshCounts(); }, 450);
    }
  }, [refreshCounts]);

  useEffect_tg(() => {
    const onKey = (e) => {
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      const list = filteredRef.current;
      const fi = focusIdxRef.current;
      if (e.key === "j") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(list.length - 1, (i < 0 ? 0 : i + 1)));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, (i < 0 ? 0 : i - 1)));
      } else if (e.key === "h") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, (i < 0 ? 0 : i - 1)));
      } else if (e.key === "l") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(list.length - 1, (i < 0 ? 0 : i + 1)));
      } else if (e.key === "Enter" && fi >= 0) {
        const tt = list[fi];
        if (tt) handleOpen(tt);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleOpen]);

  return (
    <div className="tools-grid">
      {filtered.map((t, i) => (
        <ToolCard key={t.id} tool={t} index={i} focused={focusIdx === i}
                  onFocus={setFocusIdx} onOpen={handleOpen} callLabel={callLabelFor(t)} />
      ))}
      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="dim tiny">// no match</div>
          <div className="display" style={{ fontSize: 40, marginTop: 8 }}>404 / VOID</div>
        </div>
      )}
    </div>
  );
}

window.ToolsGrid = ToolsGrid;
window.ToolCard = ToolCard;
