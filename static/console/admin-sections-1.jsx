// ELVISH admin — sections (site, nav/footer, hero, terminal, log, ticker)
const A = window.adm;
const { useState: useS_a } = React;

// ====================== SITE ======================
function SecSite({ state, set }) {
  const td = state.tweak_defaults || {};
  const setTd = (k, v) => set({ ...state, tweak_defaults: { ...td, [k]: v } });

  return (<>
    <A.H num="01" title="SITE" sub="content/home.json" />

    <A.Card title="DEFAULT THEME / TWEAKS" right={<span className="dim">applies on first visit · users can override</span>}>
      <A.FRow label="Theme" hint="Must match what site.js expects."><A.Seg value={td.theme} onChange={(v) => setTd("theme", v)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} /></A.FRow>
      <A.FRow label="Font"><A.Select value={td.font} onChange={(v) => setTd("font", v)} options={window.TWEAK_FONT_OPTIONS} /></A.FRow>
      <A.FRow label="Background grid"><A.Toggle checked={td.show_grid} onChange={(v) => setTd("show_grid", v)} label={td.show_grid ? "ON" : "OFF"} /></A.FRow>
      <A.FRow label="Scanlines"><A.Toggle checked={td.scanlines} onChange={(v) => setTd("scanlines", v)} label={td.scanlines ? "ON" : "OFF"} /></A.FRow>
      <A.FRow label="Crosshair cursor"><A.Toggle checked={td.crosshair} onChange={(v) => setTd("crosshair", v)} label={td.crosshair ? "ON" : "OFF"} /></A.FRow>
    </A.Card>

    <A.Card title="SUPPORT EMAILS" right={<span className="dim">public · mailto + security.txt</span>}>
      <div className="adm-explain" style={{ marginBottom: 12 }}>
        Default and optional labeled addresses shown on the security page, site footer, and <code>/.well-known/security.txt</code>.
        This does <strong>not</strong> create mail routes — provision <code>mail_aliases</code> and MX for each address on your domain.
      </div>
      <A.FRow label="Default support email" hint="Primary contact (optional).">
        <A.Input
          value={(state.support && state.support.default_email) || ""}
          onChange={(v) => set({ ...state, support: { ...(state.support || {}), default_email: v, contacts: (state.support && state.support.contacts) || [] } })}
          placeholder="support@example.com"
        />
      </A.FRow>
      <div style={{ marginTop: 14 }}>
        <div className="dim" style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 8 }}>CUSTOM CONTACTS</div>
        <A.Repeater
          items={(state.support && state.support.contacts) || []}
          onChange={(next) => set({ ...state, support: { ...(state.support || {}), default_email: (state.support && state.support.default_email) || "", contacts: next } })}
          addLabel="add contact"
          newItem={() => ({ label: "", email: "" })}
          render={(it, i, upd) => (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="Label (e.g. Security)" />
              <A.Input value={it.email} onChange={(v) => upd({ ...it, email: v })} placeholder="email@example.com" />
            </div>
          )}
        />
      </div>
    </A.Card>
  </>);
}

// ====================== NAV + FOOTER ======================
function SecNav({ state, set }) {
  const setNav = (next) => set({ ...state, nav: next });
  const setFooter = (k, v) => set({ ...state, footer: { ...state.footer, [k]: v } });

  return (<>
    <A.H num="02" title="NAV & FOOTER" sub="top nav, footer columns, ASCII signature" />
    <div className="adm-explain">Top-nav <code>id</code> drives active state in <code>setNavActive</code> — keep <code>tools</code> and <code>log</code> ids so highlighting works.</div>

    <A.Card title="TOP NAVIGATION">
      <A.Repeater
        items={state.nav}
        onChange={setNav}
        addLabel="add nav item"
        newItem={() => ({ id: "", href: "#", label: "NEW" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10 }}>
            <A.Input value={it.id}    onChange={(v) => upd({ ...it, id: v })}    placeholder="id" />
            <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="LABEL" />
            <A.Input value={it.href}  onChange={(v) => upd({ ...it, href: v })}  placeholder="href" />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="FOOTER · TAGLINE">
      <A.Textarea value={state.footer.tagline} onChange={(v) => setFooter("tagline", v)} />
    </A.Card>

    <A.Card title="FOOTER · PAGES">
      <A.Repeater
        items={state.footer.pages}
        onChange={(v) => setFooter("pages", v)}
        addLabel="add link"
        newItem={() => ({ href: "#", label: "Link" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="label" />
            <A.Input value={it.href}  onChange={(v) => upd({ ...it, href: v })}  placeholder="href" />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="FOOTER · PROTOCOL LINES">
      <A.Repeater
        items={state.footer.protocol}
        onChange={(v) => setFooter("protocol", v)}
        addLabel="add line"
        newItem={() => "New line"}
        render={(it, i, upd) => <A.Input value={it} onChange={upd} />}
      />
    </A.Card>

    <A.Card title="FOOTER · ASCII SIGNATURE" right={<span className="dim">monospace · preserves whitespace</span>}>
      <A.Textarea tall value={state.footer.ascii_block} onChange={(v) => setFooter("ascii_block", v)} />
      <A.FRow
        label="Scale ASCII to column"
        hint="On: shrink to fit the SIGN cell (no horizontal scroll). Off: fixed size with horizontal scroll if needed."
      >
        <A.Toggle
          checked={!!state.footer.ascii_scale_to_fit}
          onChange={(v) => setFooter("ascii_scale_to_fit", v)}
          label={state.footer.ascii_scale_to_fit ? "FIT WIDTH" : "NATURAL"}
        />
      </A.FRow>
      <div className="live-well" style={{ marginTop: 14 }}>
        <pre style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.1, fontFamily: "var(--font)" }}>{state.footer.ascii_block}</pre>
      </div>
    </A.Card>
  </>);
}

// ====================== HERO ======================
function HeadlineEditor({ lines, onChange }) {
  return (
    <A.Repeater
      items={lines}
      onChange={onChange}
      addLabel="add line"
      newItem={() => ({ parts: [{ stripe: false, text: "NEW LINE" }] })}
      render={(line, i, upd) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="dim" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>LINE {i + 1} · {line.parts.length} parts</div>
          <A.Repeater
            items={line.parts}
            onChange={(parts) => upd({ ...line, parts })}
            addLabel="add part"
            newItem={() => ({ stripe: false, text: " text " })}
            render={(p, j, updP) => (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
                <A.Input value={p.text} onChange={(v) => updP({ ...p, text: v })} />
                <A.Toggle checked={p.stripe} onChange={(v) => updP({ ...p, stripe: v })} label="STRIPE" />
              </div>
            )}
          />
        </div>
      )}
    />
  );
}

function SecHero({ state, set }) {
  const h = state.hero;
  const setH = (k, v) => set({ ...state, hero: { ...state.hero, [k]: v } });
  const setTs = (k, v) => set({ ...state, hero: { ...state.hero, tools_section: { ...state.hero.tools_section, [k]: v } } });

  return (<>
    <A.H num="03" title="HERO" sub="lines · lede · stats · sys · keyboard · bars" />
    <div className="adm-explain">The big block at the top of the home page. Headlines are split into <code>parts</code> so you can stripe sub-words; lede is Markdown.</div>

    <A.Card title="SECTION HEADER">
      <div className="split-2">
        <A.FRow label="Section index"><A.Input value={h.section_index} onChange={(v) => setH("section_index", v)} /></A.FRow>
        <A.FRow label="Section title"><A.Input value={h.section_title} onChange={(v) => setH("section_title", v)} /></A.FRow>
      </div>
    </A.Card>

    <A.Card title="HEADLINES" right={<span className="dim">stripe = orange highlight word</span>}>
      <HeadlineEditor lines={h.lines} onChange={(v) => setH("lines", v)} />
      <div className="live-well" style={{ marginTop: 16 }}>
        <div className="display" style={{ fontSize: 56 }}>
          {h.lines.map((ln, i) => (
            <div key={i}>{ln.parts.map((p, j) => p.stripe ? <span key={j} style={{ background: "var(--accent)", color: "#0a0a0a", padding: "0 0.08em" }}>{p.text}</span> : <span key={j}>{p.text}</span>)}</div>
          ))}
        </div>
      </div>
    </A.Card>

    <A.Card title="LEDE · MARKDOWN" right={<span className="dim">GFM</span>}>
      <div className="md-editor">
        <textarea value={h.lede_markdown} onChange={(e) => setH("lede_markdown", e.target.value)} />
        <div className="md-preview" dangerouslySetInnerHTML={{ __html: A.mdRender(h.lede_markdown) }} />
      </div>
    </A.Card>

    <A.Card title="STATS · 4-UP META">
      <A.Repeater items={h.stats} onChange={(v) => setH("stats", v)}
        addLabel="add stat"
        newItem={() => ({ key: "KEY", value: "0" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <A.Input value={it.key}   onChange={(v) => upd({ ...it, key: v })}   placeholder="key" />
            <A.Input value={it.value} onChange={(v) => upd({ ...it, value: v })} placeholder="value" />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="LOAD BAR HEIGHTS" right={<span className="dim">{h.load_bar_heights.length} bars</span>}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, border: "1px solid var(--line)", padding: 8 }}>
        {h.load_bar_heights.map((v, i) => (
          <div key={i} style={{ flex: 1, background: i === 10 ? "var(--accent)" : "var(--fg)", height: `${v}px`, position: "relative" }}>
            <input type="number" min="0" max="80" value={v}
              onChange={(e) => { const next = h.load_bar_heights.slice(); next[i] = parseInt(e.target.value || "0", 10); setH("load_bar_heights", next); }}
              style={{ position: "absolute", bottom: -22, left: -4, right: -4, fontSize: 9, padding: 1, background: "transparent", border: 0, color: "var(--dim)", textAlign: "center", fontFamily: "var(--font)" }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 32, display: "flex", gap: 8 }}>
        <button className="btn-sm" onClick={() => setH("load_bar_heights", [...h.load_bar_heights, 32])}>+ bar</button>
        <button className="btn-sm" onClick={() => setH("load_bar_heights", h.load_bar_heights.slice(0, -1))} disabled={h.load_bar_heights.length <= 1}>− bar</button>
        <button className="btn-sm" onClick={() => setH("load_bar_heights", h.load_bar_heights.map(() => 20 + Math.floor(Math.random() * 40)))}>shuffle</button>
      </div>
    </A.Card>

    <A.Card title="SYSTEM STATUS ROWS">
      <A.Repeater items={h.sys_rows} onChange={(v) => setH("sys_rows", v)}
        addLabel="add row"
        newItem={() => ({ label: "LABEL", value: "● VALUE", status: "ok" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 200px", gap: 10 }}>
            <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="label" />
            <A.Input value={it.value} onChange={(v) => upd({ ...it, value: v })} placeholder="value" />
            <A.Seg value={it.status} onChange={(v) => upd({ ...it, status: v })} options={[
              { value: "ok", label: "OK" }, { value: "accent", label: "ACCENT" }, { value: "dim", label: "DIM" }
            ]} />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="KEYBOARD ROWS">
      <A.Repeater items={h.keyboard_rows} onChange={(v) => setH("keyboard_rows", v)}
        addLabel="add row"
        newItem={() => ({ label: "LABEL", key: "k" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
            <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="label" />
            <A.Input value={it.key}   onChange={(v) => upd({ ...it, key: v })}   placeholder="key" />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="TOOLS BAND LABEL">
      <div className="split-3">
        <A.FRow label="Index"><A.Input value={h.tools_section.section_index} onChange={(v) => setTs("section_index", v)} /></A.FRow>
        <A.FRow label="Title"><A.Input value={h.tools_section.section_title} onChange={(v) => setTs("section_title", v)} /></A.FRow>
        <A.FRow label="Hint"><A.Input value={h.tools_section.hint} onChange={(v) => setTs("hint", v)} /></A.FRow>
      </div>
    </A.Card>
  </>);
}

// ====================== TERMINAL ======================
function SecTerminal({ state, set }) {
  const setLines = (v) => set({ ...state, terminal: { ...state.terminal, lines: v } });
  const KIND_PRESETS = [
    { kind: "sys",    text: "elvish:~$ " },
    { kind: "log",    text: "[ OK ] " },
    { kind: "log",    text: "[ WARN ] " },
    { kind: "log",    text: "[ FAIL ] " },
    { kind: "head",   text: "// " },
    { kind: "prompt", text: "elvish:~$ " },
    { kind: "blank",  text: "" }
  ];
  return (<>
    <A.H num="04" title="TERMINAL BOOT" sub="content/home.json · terminal.lines[]" />
    <div className="adm-explain">Each line has a <code>kind</code> that drives styling: <code>sys</code> (prompt highlighted), <code>log</code> (gray with optional <code>[ STATUS ]</code> prefix), <code>head</code> (white emphasized), <code>prompt</code> (final prompt line), <code>blank</code> (spacer). Kind must match site.js.</div>

    <A.Card title="LINES" right={<span className="dim">{state.terminal.lines.length} lines</span>}>
      <A.Repeater items={state.terminal.lines} onChange={setLines}
        addLabel="add line"
        newItem={() => ({ kind: "log", text: "[ OK ] " })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <A.Select value={it.kind} onChange={(v) => upd({ ...it, kind: v })} options={window.TERMINAL_KINDS} />
            <A.Input value={it.text} onChange={(v) => upd({ ...it, text: v })} placeholder={it.kind === "blank" ? "(blank line)" : "text"} />
          </div>
        )}
      />
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span className="dim" style={{ fontSize: 10, letterSpacing: "0.18em", padding: "4px 0" }}>PRESETS ▸</span>
        {KIND_PRESETS.map((p, i) => (
          <button key={i} className="btn-sm"
                  onClick={() => setLines([...state.terminal.lines, { ...p }])}>+ {p.kind}: {p.text || "blank"}</button>
        ))}
      </div>
    </A.Card>

    <A.Card title="LIVE PREVIEW">
      <div className="live-well">
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          {state.terminal.lines.map((l, i) => {
            if (l.kind === "blank") return <div key={i}>&nbsp;</div>;
            if (l.kind === "sys" || l.kind === "prompt") {
              const split = l.text.indexOf("$");
              if (split > 0) return <div key={i}><span style={{ color: "var(--accent)" }}>{l.text.slice(0, split + 1)}</span><span>{l.text.slice(split + 1)}</span></div>;
              return <div key={i} style={{ color: "var(--accent)" }}>{l.text}</div>;
            }
            if (l.kind === "log") {
              const m = l.text.match(/^(\[ \w+ \])(.*)$/);
              if (m) return <div key={i}><span style={{ color: "var(--ok)" }}>{m[1]}</span><span style={{ color: "var(--dim)" }}>{m[2]}</span></div>;
              return <div key={i} style={{ color: "var(--dim)" }}>{l.text}</div>;
            }
            return <div key={i} style={{ fontWeight: 700 }}>{l.text}</div>;
          })}
        </div>
      </div>
    </A.Card>
  </>);
}

// ====================== LOG PAGE ======================
function SecLogPage({ state, set }) {
  const lp = state.log_page;
  const setLp = (k, v) => set({ ...state, log_page: { ...state.log_page, [k]: v } });
  return (<>
    <A.H num="06" title="LOG PAGE CHROME" sub="hero · filters · ticker on /log" />
    <div className="adm-explain">Filter <code>id</code>s should match post tags (case-insensitive). Use <code>all</code> for the no-op default.</div>

    <A.Card title="SECTION HEADER">
      <div className="split-2">
        <A.FRow label="Index"><A.Input value={lp.section_index} onChange={(v) => setLp("section_index", v)} /></A.FRow>
        <A.FRow label="Title"><A.Input value={lp.section_title} onChange={(v) => setLp("section_title", v)} /></A.FRow>
      </div>
    </A.Card>

    <A.Card title="HEADLINES">
      <HeadlineEditor lines={lp.headlines} onChange={(v) => setLp("headlines", v)} />
    </A.Card>

    <A.Card title="INTRO · MARKDOWN">
      <div className="md-editor">
        <textarea value={lp.intro_markdown} onChange={(e) => setLp("intro_markdown", e.target.value)} />
        <div className="md-preview" dangerouslySetInnerHTML={{ __html: A.mdRender(lp.intro_markdown) }} />
      </div>
    </A.Card>

    <A.Card title="ACCENT TAGLINE">
      <A.Input value={lp.tagline_accent} onChange={(v) => setLp("tagline_accent", v)} />
    </A.Card>

    <A.Card title="FILTERS" right={<span className="dim">id matches post tags</span>}>
      <A.Repeater items={lp.filters} onChange={(v) => setLp("filters", v)}
        addLabel="add filter"
        newItem={() => ({ id: "tag", label: "TAG" })}
        render={(it, i, upd) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <A.Input value={it.id}    onChange={(v) => upd({ ...it, id: v })}    placeholder="id (lowercase)" />
            <A.Input value={it.label} onChange={(v) => upd({ ...it, label: v })} placeholder="LABEL" />
          </div>
        )}
      />
    </A.Card>

    <A.Card title="LOG TICKER" right={<span className="dim">{lp.ticker.length} strings</span>}>
      <A.Repeater items={lp.ticker} onChange={(v) => setLp("ticker", v)}
        addLabel="add line" newItem={() => "NEW"}
        render={(it, i, upd) => <A.Input value={it} onChange={upd} />}
      />
    </A.Card>
  </>);
}

// ====================== TICKER ======================
function SecTicker({ state, set }) {
  return (<>
    <A.H num="07" title="HOME TICKER" sub="strings scrolling above the footer" />
    <div className="adm-explain">Plain string list. Repeated automatically client-side to fill the marquee.</div>
    <A.Card title="TICKER STRINGS" right={<span className="dim">{state.ticker_home.length} entries</span>}>
      <A.Repeater items={state.ticker_home} onChange={(v) => set({ ...state, ticker_home: v })}
        addLabel="add string" newItem={() => "NEW"}
        render={(it, i, upd) => <A.Input value={it} onChange={upd} />}
      />
    </A.Card>
  </>);
}

window.SecSite = SecSite;
window.SecNav = SecNav;
window.SecHero = SecHero;
window.SecTerminal = SecTerminal;
window.SecLogPage = SecLogPage;
window.SecTicker = SecTicker;
