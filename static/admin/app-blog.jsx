// ELVISH blog app
const { useState: useS_b, useEffect: useE_b } = React;

function BlogApp() {
  const T = window.useTweaks({
    "theme": "dark",
    "font": "ibm",
    "scanlines": true,
    "showGrid": true,
    "crosshair": false
  });
  const [tweak, setTweak] = T;

  const [filter, setFilter] = useS_b("all");

  useE_b(() => {
    document.documentElement.setAttribute("data-theme", tweak.theme);
    document.documentElement.setAttribute("data-font", tweak.font);
    document.body.classList.toggle("crosshair-on", !!tweak.crosshair);
  }, [tweak.theme, tweak.font, tweak.crosshair]);

  // Konami
  useE_b(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let pos = 0;
    const onKey = (e) => {
      if (e.key === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          document.body.classList.add("konami");
          setTimeout(() => document.body.classList.remove("konami"), 1200);
        }
      } else { pos = (e.key === seq[0]) ? 1 : 0; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // crosshair
  useE_b(() => {
    if (!tweak.crosshair) return;
    const el = document.querySelector(".crosshair");
    if (!el) return;
    const onMove = (e) => { el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [tweak.crosshair]);

  const entries = window.ENTRIES || [];
  const filtered = filter === "all" ? entries : entries.filter(e => e.tags.includes(filter));

  const FILTERS = [
    { id: "all", label: "ALL" },
    { id: "release", label: "RELEASE" },
    { id: "essay", label: "ESSAY" },
    { id: "security", label: "SECURITY" },
    { id: "notes", label: "NOTES" },
    { id: "infra", label: "INFRA" }
  ];

  return (
    <>
      {tweak.showGrid && <div className="bg-grid"></div>}
      {tweak.scanlines && <div className="scanline"></div>}
      <div className="crosshair"></div>

      <div className="frame">
        <window.Topbar active="log" />
        <div style={{ marginTop: 8, marginBottom: 4, fontSize: 10, letterSpacing: "0.18em", color: "var(--dim)", textTransform: "uppercase", textAlign: "right" }}>
          <a href="/login" style={{ color: "var(--accent)" }}>log in</a>
          <span className="dim"> · </span>
          <a href="/register" style={{ color: "var(--accent)" }}>register</a>
          <span className="dim"> · </span>
          <a href="/admin/" style={{ color: "var(--accent)" }}>panel</a>
        </div>

        <section className="manifesto">
          <div>
            <div className="section-label"><span className="index">§ LOG</span> CHRONOLOGY <span className="rule"></span></div>
            <h1 style={{ marginTop: 18 }}>
              THE <span className="stripe">LOG</span><br/>
              IS THE PRODUCT<br/>
              CHANGELOG.
            </h1>
            <p>Releases, audit notes, the occasional essay. Nothing scheduled. No newsletter. Bookmark or scrape; both are blessed.</p>
            <p style={{ marginTop: 8, color: "var(--accent)" }}>// reverse-chronological. tail -f the world.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="bracket" style={{ padding: 14, position: "relative" }}>
              <span className="br-bl"></span><span className="br-br"></span>
              <div className="ftk" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--dim)", marginBottom: 8 }}>// FEED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">RSS</span><span style={{ color: "var(--accent)" }}>/feed.xml</span></div>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">JSON</span><span style={{ color: "var(--accent)" }}>/feed.json</span></div>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">ATOM</span><span style={{ color: "var(--accent)" }}>/atom.xml</span></div>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">SIGNED</span><span><a href="/pgp/keys.json" style={{ color: "var(--accent)" }}>/pgp/keys.json</a></span></div>
              </div>
            </div>
            <div className="bracket" style={{ padding: 14, position: "relative" }}>
              <span className="br-bl"></span><span className="br-br"></span>
              <div className="ftk" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--dim)", marginBottom: 8 }}>// COUNTS</div>
              <div className="row" style={{ justifyContent: "space-between", padding: "3px 0" }}><span className="dim">ENTRIES</span><span>{entries.length}</span></div>
              <div className="row" style={{ justifyContent: "space-between", padding: "3px 0" }}><span className="dim">FIRST</span><span>26.01.05</span></div>
              <div className="row" style={{ justifyContent: "space-between", padding: "3px 0" }}><span className="dim">LATEST</span><span style={{ color: "var(--accent)" }}>26.04.28</span></div>
              <div className="row" style={{ justifyContent: "space-between", padding: "3px 0" }}><span className="dim">CADENCE</span><span>WHEN-READY</span></div>
            </div>
          </div>
        </section>

        <div className="cl-filterbar">
          <span className="tiny dim">FILTER ▸</span>
          {FILTERS.map(f => (
            <span key={f.id}
                  className={"cl-filter" + (filter === f.id ? " on" : "")}
                  onClick={() => setFilter(f.id)}>
              {f.label}
            </span>
          ))}
          <span className="tiny dim" style={{ marginLeft: "auto" }}>{filtered.length} / {entries.length} ENTRIES</span>
        </div>

        <div className="changelog">
          <div className="cl-head">
            <span>DATE</span><span>ENTRY</span><span>BYTES · REACH</span>
          </div>
          {filtered.map((e, i) => (
            <article key={i} className="cl-entry">
              <div className="cl-date">
                <span className="y">{e.date}</span>
                <span className="t">{e.time} UTC</span>
              </div>
              <div className="cl-body">
                <div className="cl-tagrow">
                  {e.tags.map(t => <span key={t} className={"cl-tag " + t}>{t}</span>)}
                </div>
                <h2 className="cl-title">{e.title}</h2>
                <div className="cl-prose">{e.body}</div>
                <div className="cl-meta">
                  <span><span className="k">▸</span>BYTES · {e.bytes}</span>
                  <span><span className="k">▸</span>REACH · {e.reach}</span>
                  <span><span className="k">▸</span>PERMALINK · /log/{e.date}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="stripe-band"></div>

        <div className="ticker" style={{ marginTop: 16 }}>
          <div className="ticker-track">
            <span>END OF LOG</span><span>NO COMMENTS</span><span>NO TRACKERS</span><span>NO PAYWALL</span>
            <span>SUBSCRIBE VIA RSS OR DON'T</span><span>I'M NOT KEEPING SCORE</span>
            <span>END OF LOG</span><span>NO COMMENTS</span><span>NO TRACKERS</span><span>NO PAYWALL</span>
            <span>SUBSCRIBE VIA RSS OR DON'T</span><span>I'M NOT KEEPING SCORE</span>
          </div>
        </div>

        <Footer />

        <window.TweaksPanel title="TWEAKS">
          <window.TweakSection title="Appearance">
            <window.TweakRadio
              label="Theme"
              value={tweak.theme}
              onChange={(v) => setTweak("theme", v)}
              options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
            />
            <window.TweakSelect
              label="Font"
              value={tweak.font}
              onChange={(v) => setTweak("font", v)}
              options={[
                { value: "ibm",       label: "IBM Plex Mono" },
                { value: "jetbrains", label: "JetBrains Mono" },
                { value: "space",     label: "Space Mono / Grotesk" },
                { value: "display",   label: "Plex + Anton display" }
              ]}
            />
          </window.TweakSection>
          <window.TweakSection title="Effects">
            <window.TweakToggle label="Background grid"  value={tweak.showGrid}   onChange={(v) => setTweak("showGrid",  v)} />
            <window.TweakToggle label="Scanlines"        value={tweak.scanlines}  onChange={(v) => setTweak("scanlines", v)} />
            <window.TweakToggle label="Crosshair cursor" value={tweak.crosshair}  onChange={(v) => setTweak("crosshair", v)} />
          </window.TweakSection>
        </window.TweaksPanel>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BlogApp />);
