// ELVISH modals — brutalist set
const { useState: useS_m, useEffect: useE_m, useMemo: useM_m, useRef: useR_m } = React;

// ============ Modal shell ============
function genPid() { return "0x" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0"); }

function Modal({ open, onClose, title, kind = "MODAL", status, size, children, footer, dismissable = true }) {
  const pidRef = useR_m(genPid());
  useE_m(() => {
    if (!open || !dismissable) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, dismissable, onClose]);
  if (!open) return null;
  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={dismissable ? onClose : undefined}></div>
      <div className={"modal" + (size ? " " + size : "")} role="dialog" aria-modal="true">
        <span className="br-bl"></span><span className="br-br"></span>
        <div className="mod-bar">
          <span className="pid">▸ {kind}</span>
          <span className="ttl">{title}</span>
          <span className="stat">{status || `PID ${pidRef.current}`}</span>
          <button className="mod-close" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="mod-body">{children}</div>
        {footer && <div className="mod-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ============ Confirm Destroy ============
function ConfirmDestroyModal({ open, onClose, onConfirm, target, label = "DELETE", phrase = "DELETE" }) {
  const [t, setT] = useS_m("");
  useE_m(() => { if (open) setT(""); }, [open]);
  const armed = t === phrase;
  return (
    <Modal open={open} onClose={onClose} title={label + " · " + (target?.name || "ITEM")} kind="CONFIRM" status="DESTRUCTIVE">
      <div className="mod-head-block">
        <div className="mod-icon warn"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 L22 20 L2 20 Z"/><line x1="12" y1="10" x2="12" y2="15"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor"/></svg>
        </div>
        <div className="txt">
          <h2>This cannot be undone.</h2>
          <p>The record will be removed from the working state. If already published, the next deploy will remove it from the live site and feeds. Mirrors and archives may retain copies.</p>
        </div>
      </div>
      {target && (
        <div className="confirm-row">
          <div className="label">▸ Target</div>
          <div className="val">{target.name}</div>
          {target.path && <div className="dim mono" style={{ fontSize: 10, marginTop: 6 }}>{target.path}</div>}
          {target.detail && <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>{target.detail}</div>}
        </div>
      )}
      <div className="confirm-type">
        <div className="lbl">Type <code>{phrase}</code> to confirm</div>
        <input className="inp" autoFocus value={t} onChange={(e) => setT(e.target.value.toUpperCase())} />
      </div>
      <div style={{ marginTop: 14, fontSize: 10, color: "var(--dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        ▾ on confirm: state.update → diff queued → next commit
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l"><kbd>esc</kbd> cancel · <kbd>↵</kbd> confirm when armed</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose}>cancel</button>
          <button className="btn-sm primary" disabled={!armed} onClick={() => { onConfirm && onConfirm(); onClose(); }}>{armed ? "▸ DESTROY" : "ARMED ON " + phrase}</button>
        </div>
      </div>
    </Modal>
  );
}

// ============ Tool Preview ============
function ToolPreviewModal({ open, onClose, tool }) {
  if (!tool) return null;
  return (
    <Modal open={open} onClose={onClose} title={"/" + tool.slug} kind="PREVIEW" status={"GLYPH · " + tool.glyph} size="wide">
      <div className="tool-preview">
        <div className="tool-preview-left">
          <div className="big-glyph"><window.Glyph name={tool.glyph} /></div>
          <div className="nm">{tool.name}</div>
          <span className={"tag " + tool.tag}>{tool.tag}</span>
          <div className="dim tiny">ID · {tool.id}</div>
        </div>
        <div className="tool-preview-right">
          <div>
            <div className="dim tiny">// DESCRIPTION</div>
            <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6 }}>{tool.desc}</p>
          </div>
          <div>
            <div className="dim tiny" style={{ marginBottom: 6 }}>// STACK</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(tool.signals ?? tool.stack ?? []).map(s => <span key={s} className="stack-chip">{s}</span>)}
            </div>
          </div>
          <div className="specs">
            <div><div className="k">CALLS</div><div className="v">{tool.calls}</div></div>
            <div><div className="k">SINCE</div><div className="v">{tool.since}</div></div>
            <div><div className="k">SLUG</div><div className="v" style={{ fontSize: 12 }}>/{tool.slug}</div></div>
            <div><div className="k">STATUS</div><div className="v" style={{ color: "var(--accent)" }}>{tool.tag.toUpperCase()}</div></div>
          </div>
        </div>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">read-only · derived from <kbd>tools[]</kbd></div>
        <div className="r">
          <button className="btn-sm" onClick={onClose}>close</button>
          <button
            type="button"
            className="btn-sm primary"
            title="Opens the public home in a new tab (tool grid; no per-slug route)."
            onClick={() => {
              window.open("/", "_blank", "noopener,noreferrer");
              onClose && onClose();
            }}
          >▸ open site · /{tool.slug}</button>
        </div>
      </div>
    </Modal>
  );
}

// ============ Command Palette ============
function CommandPaletteModal({ open, onClose, commands, onRun }) {
  const [q, setQ] = useS_m("");
  const [idx, setIdx] = useS_m(0);
  useE_m(() => { if (open) { setQ(""); setIdx(0); } }, [open]);
  const filtered = useM_m(() => {
    if (!q) return commands;
    const ql = q.toLowerCase();
    return commands.filter(c => (c.name + " " + c.scope + " " + (c.alias || "")).toLowerCase().includes(ql));
  }, [q, commands]);
  useE_m(() => { setIdx(0); }, [q]);
  useE_m(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); const c = filtered[idx]; if (c) { onRun && onRun(c); onClose && onClose(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, idx, onRun, onClose]);
  return (
    <Modal open={open} onClose={onClose} title="COMMAND PALETTE" kind="CMDP" status={`${filtered.length}/${commands.length}`}>
      <div className="cmdp">
        <input className="cmdp-input" autoFocus placeholder="run command, jump to section, find tool…  e.g. `tools`, `new post`, `deploy`"
               value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cmdp-list">
          {filtered.length === 0 && <div className="cmdp-empty">// no match — try a different word</div>}
          {filtered.map((c, i) => (
            <div key={c.id} className={"cmdp-row" + (i === idx ? " on" : "")}
                 onMouseEnter={() => setIdx(i)}
                 onClick={() => { onRun && onRun(c); onClose && onClose(); }}>
              <span className="ic">{c.glyph || "▸"}</span>
              <span className="nm">{c.name}</span>
              <span className="scope">{c.scope}</span>
              <span className="kbd">{c.shortcut || ""}</span>
            </div>
          ))}
        </div>
        <div className="cmdp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> nav</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>▸ {filtered.length} results</span>
        </div>
      </div>
    </Modal>
  );
}

// ============ Keyboard Shortcuts ============
function ShortcutsModal({ open, onClose }) {
  const groups = [
    { h: "GLOBAL", rows: [
      { l: "Open command palette", k: ["⌘", "K"] },
      { l: "Toggle this overlay",  k: ["?"] },
      { l: "Focus search",         k: ["/"] },
      { l: "Blur / cancel",        k: ["esc"] },
      { l: "Konami",               k: ["↑↑↓↓←→←→BA"] }
    ]},
    { h: "TOOL GRID", rows: [
      { l: "Focus next", k: ["j"] },
      { l: "Focus prev", k: ["k"] },
      { l: "Open focused", k: ["↵"] },
      { l: "Preview", k: ["space"] }
    ]},
    { h: "ADMIN", rows: [
      { l: "Commit changes", k: ["⌘", "S"] },
      { l: "New post", k: ["⌘", "N"] },
      { l: "New tool", k: ["⌘", "⇧", "N"] },
      { l: "Goto site", k: ["g", "s"] },
      { l: "Goto tools", k: ["g", "t"] },
      { l: "Goto posts", k: ["g", "p"] }
    ]},
    { h: "POST EDITOR", rows: [
      { l: "Bold",           k: ["⌘", "B"] },
      { l: "Italic",         k: ["⌘", "I"] },
      { l: "Inline code",    k: ["⌘", "E"] },
      { l: "Save as draft",  k: ["⌘", "D"] },
      { l: "Publish",        k: ["⌘", "↵"] }
    ]}
  ];
  return (
    <Modal open={open} onClose={onClose} title="KEYBOARD" kind="HELP" status="ALL BINDINGS" size="wide">
      <div className="mod-head-block">
        <div className="mod-icon"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="7" y1="14" x2="17" y2="14"/></svg>
        </div>
        <div className="txt">
          <h2>Drive everything from the keyboard.</h2>
          <p>Elvish is built for the ⌘K crowd. Press <kbd>?</kbd> at any time to bring this card back.</p>
        </div>
      </div>
      <div className="shortcuts">
        {groups.map(g => (
          <div key={g.h} className="shortcut-section">
            <h4>// {g.h}</h4>
            {g.rows.map((r, i) => (
              <div key={i} className="shortcut-row">
                <span className="lab">{r.l}</span>
                <span className="keys">{r.k.map((k, j) => <kbd key={j}>{k}</kbd>)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">ELVISH shortcut sheet · v0.7.4</div>
        <div className="r"><button className="btn-sm primary" onClick={onClose}>got it</button></div>
      </div>
    </Modal>
  );
}

// ============ Auth / re-login ============
function AuthModal({ open, onClose, onAuth, emailHint }) {
  const [u, setU] = useS_m("");
  const [p, setP] = useS_m("");
  const [phase, setPhase] = useS_m("idle"); // idle | checking | err | ok
  const [errDetail, setErrDetail] = useS_m("");
  useE_m(() => { if (open) { setU(emailHint || ""); setP(""); setPhase("idle"); setErrDetail(""); } }, [open, emailHint]);
  const submit = async () => {
    const username = (emailHint || u || "").trim().toLowerCase();
    if (!username || !p) { setPhase("err"); setErrDetail("username and password required"); return; }
    setPhase("checking");
    setErrDetail("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password: p })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("err");
        setErrDetail(j.error || "login failed");
        return;
      }
      setPhase("ok");
      const disp = (j.user && j.user.username) || username;
      setTimeout(() => { onAuth && onAuth({ user: disp }); onClose && onClose(); }, 400);
    } catch (e) {
      setPhase("err");
      setErrDetail("network error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="RE-AUTHENTICATE" kind="AUTH" status={phase.toUpperCase()} size="narrow" dismissable={phase !== "checking"}>
      <div className="mod-head-block">
        <div className="mod-icon"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10"/><path d="M8 11 V7 a4 4 0 0 1 8 0 V11"/></svg>
        </div>
        <div className="txt">
          <h2>Confirm your password.</h2>
          <p>Required before sensitive actions (OpenPGP key upload, content migration). Uses the same session cookie as login.</p>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-line"><span className="pmt">elvish:~$</span> <span className="dim">login —</span></div>
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>USER</span><input type="text" autoFocus={!emailHint} readOnly={!!emailHint} value={emailHint || u} onChange={(e) => !emailHint && setU(e.target.value)} placeholder="username" disabled={phase === "checking"} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>PASSWORD</span><input type="password" autoFocus={!!emailHint} value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" disabled={phase === "checking"} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <div className={"auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "")}>
          {phase === "idle"     && "▸ awaiting input"}
          {phase === "checking" && "▸ verifying… ●"}
          {phase === "err"      && ("✕ " + (errDetail || "AUTH FAILED"))}
          {phase === "ok"       && "✓ SESSION REFRESHED"}
        </div>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">HTTP-only cookie · Valkey-backed session</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose} disabled={phase === "checking"}>cancel</button>
          <button className="btn-sm primary" disabled={phase === "checking" || phase === "ok"} onClick={submit}>▸ CONFIRM</button>
        </div>
      </div>
    </Modal>
  );
}

function RegisterModal({ open, onClose, onDone }) {
  const [username, setUsername] = useS_m("");
  const [password, setPassword] = useS_m("");
  const [name, setName] = useS_m("");
  const [phase, setPhase] = useS_m("idle");
  const [errDetail, setErrDetail] = useS_m("");
  useE_m(() => { if (open) { setUsername(""); setPassword(""); setName(""); setPhase("idle"); setErrDetail(""); } }, [open]);
  const submit = async () => {
    const u = username.trim().toLowerCase();
    if (!u || password.length < 10) { setPhase("err"); setErrDetail("username required · password min 10 chars"); return; }
    setPhase("checking");
    setErrDetail("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password, name: name.trim(), company: "" })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setPhase("err"); setErrDetail(j.error || "register failed"); return; }
      setPhase("ok");
      setTimeout(() => { onDone && onDone(j); onClose && onClose(); }, 400);
    } catch (e) {
      setPhase("err");
      setErrDetail("network error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="REGISTER" kind="AUTH" status={phase.toUpperCase()} size="narrow" dismissable={phase !== "checking"}>
      <div className="mod-head-block">
        <div className="mod-icon ok"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div className="txt">
          <h2>Create an account.</h2>
          <p>Password is hashed server-side (bcrypt). Session is stored in Valkey with an HTTP-only cookie.</p>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>USER</span><input type="text" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} disabled={phase === "checking"} /></div>
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>DISPLAY</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" disabled={phase === "checking"} /></div>
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>PASSWORD</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 10 characters" disabled={phase === "checking"} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <div className={"auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "")}>
          {phase === "idle" && "▸ awaiting input"}
          {phase === "checking" && "▸ creating account… ●"}
          {phase === "err" && ("✕ " + errDetail)}
          {phase === "ok" && "✓ REGISTERED · logged in"}
        </div>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">requires MongoDB + Valkey</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose} disabled={phase === "checking"}>cancel</button>
          <button className="btn-sm primary" disabled={phase === "checking" || phase === "ok"} onClick={submit}>▸ REGISTER</button>
        </div>
      </div>
    </Modal>
  );
}

function LoginModal({ open, onClose, onDone }) {
  const [username, setUsername] = useS_m("");
  const [password, setPassword] = useS_m("");
  const [phase, setPhase] = useS_m("idle");
  const [errDetail, setErrDetail] = useS_m("");
  useE_m(() => { if (open) { setUsername(""); setPassword(""); setPhase("idle"); setErrDetail(""); } }, [open]);
  const submit = async () => {
    const u = username.trim().toLowerCase();
    if (!u || !password) { setPhase("err"); setErrDetail("username and password required"); return; }
    setPhase("checking");
    setErrDetail("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setPhase("err"); setErrDetail(j.error || "login failed"); return; }
      if (j && j.mfa_required) {
        window.location.href = "/login?next=" + encodeURIComponent("/admin/");
        return;
      }
      setPhase("ok");
      setTimeout(() => { onDone && onDone(j); onClose && onClose(); }, 400);
    } catch (e) {
      setPhase("err");
      setErrDetail("network error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="LOGIN" kind="AUTH" status={phase.toUpperCase()} size="narrow" dismissable={phase !== "checking"}>
      <div className="mod-head-block">
        <div className="mod-icon"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10"/><path d="M8 11 V7 a4 4 0 0 1 8 0 V11"/></svg>
        </div>
        <div className="txt">
          <h2>Sign in</h2>
          <p>Session cookie is set for this origin only (<code>/api/*</code>).</p>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>USER</span><input type="text" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} disabled={phase === "checking"} /></div>
        <div className="auth-line"><span className="dim" style={{ width: 80 }}>PASSWORD</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={phase === "checking"} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <div className={"auth-status " + (phase === "err" ? "err" : phase === "ok" ? "ok" : "")}>
          {phase === "idle" && "▸ awaiting input"}
          {phase === "checking" && "▸ verifying… ●"}
          {phase === "err" && ("✕ " + errDetail)}
          {phase === "ok" && "✓ LOGGED IN"}
        </div>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">MongoDB + Valkey required</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose} disabled={phase === "checking"}>cancel</button>
          <button className="btn-sm primary" disabled={phase === "checking" || phase === "ok"} onClick={submit}>▸ LOGIN</button>
        </div>
      </div>
    </Modal>
  );
}

// ============ Publish / Diff ============
function PublishModal({ open, onClose, onCommitLocal, onSaveMongo, persistHome, dirty, diff, initialNotes = "" }) {
  const [msg, setMsg] = useS_m("");
  const [signed, setSigned] = useS_m(true);
  const [busy, setBusy] = useS_m(false);
  const [err, setErr] = useS_m("");
  useE_m(() => {
    if (open) {
      setMsg(typeof initialNotes === "string" ? initialNotes : "");
      setSigned(true);
      setBusy(false);
      setErr("");
    }
  }, [open, initialNotes]);
  const counts = useM_m(() => {
    const c = { add: 0, mod: 0, del: 0 };
    (diff || []).forEach(d => { c[d.kind] = (c[d.kind] || 0) + 1; });
    return c;
  }, [diff]);
  return (
    <Modal open={open} onClose={onClose} title="PUBLISH · REVIEW" kind="PUBLISH" status={`Δ ${(diff||[]).length} CHANGES`} size="wide">
      <div className="mod-head-block">
        <div className="mod-icon ok"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,12 10,18 20,6"/></svg>
        </div>
        <div className="txt">
          <h2>Review changes before saving.</h2>
          <p>
            {persistHome
              ? <>Writes the reviewed bundle to <code>site_config.home_json</code> via <code>PUT /api/admin/site/home</code>. The public site picks it up after the content cache TTL.</>
              : <>This server is running without a MongoDB site store (<code>ELVISH_ALLOW_EMPTY_DB</code> or missing <code>MONGODB_URI</code>). Home JSON cannot be saved from the panel — edit <code className="mono">content/home.json</code> on disk instead.</>}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--line)", marginBottom: 16 }}>
        {[
          { k: "ADDED",    v: counts.add || 0, c: "var(--ok)" },
          { k: "MODIFIED", v: counts.mod || 0, c: "var(--accent)" },
          { k: "REMOVED",  v: counts.del || 0, c: "var(--accent)" },
          { k: "TOTAL",    v: (diff||[]).length, c: "var(--fg)" }
        ].map((c, i) => (
          <div key={i} style={{ padding: 12, borderRight: i < 3 ? "1px solid var(--line)" : 0 }}>
            <div className="dim tiny">{c.k}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: c.c }}>{c.v}</div>
          </div>
        ))}
      </div>

      <div className="dim tiny" style={{ marginBottom: 8 }}>// CHANGES</div>
      <div className="diff-list">
        {(diff || []).map((d, i) => (
          <div key={i} className={"diff-row " + d.kind}>
            <span className="sym">{d.kind === "add" ? "+" : d.kind === "del" ? "−" : "~"}</span>
            <span className="scope">{d.scope}</span>
            <span>{d.path}</span>
          </div>
        ))}
        {(diff || []).length === 0 && <div className="diff-row"><span></span><span className="dim">// no changes</span><span></span></div>}
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dim tiny">// PUBLISH NOTES</div>
        <textarea className="txa" placeholder="content: update tool descriptions and v0.7.4 release notes"
                  value={msg} onChange={(e) => setMsg(e.target.value)} />
        <label className="tgl">
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
          <span className="tgl-track"></span>
          <span>Require OpenPGP-detached signature on log posts (API)</span>
        </label>
      </div>

      {err && <div className="auth-status err" style={{ marginTop: 12 }}>{err}</div>}
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">{persistHome ? <code>/api/admin/site/home</code> : <span className="dim">no Mongo site store</span>}</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose} disabled={busy}>cancel</button>
          {persistHome && typeof onSaveMongo === "function" && (
            <button
              className="btn-sm primary"
              disabled={busy || !dirty || (diff || []).length === 0}
              onClick={async () => {
                setErr("");
                setBusy(true);
                try {
                  await onSaveMongo({ msg: msg.trim() || "site update", signed });
                  onCommitLocal && onCommitLocal({ msg: msg.trim() || "site update", signed });
                  onClose && onClose();
                } catch (e) {
                  setErr(String(e.message || e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "…" : "save to site"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============ OpenPGP public key upload ============
function SigningKeyModal({ open, onClose, onUpload }) {
  const [file, setFile] = useS_m(null);
  const [fp, setFp] = useS_m("");
  const [armored, setArmored] = useS_m("");
  const [phase, setPhase] = useS_m("idle");
  const [errDetail, setErrDetail] = useS_m("");
  useE_m(() => { if (open) { setFile(null); setFp(""); setArmored(""); setPhase("idle"); setErrDetail(""); } }, [open]);
  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    setFp("");
    setArmored("");
    setErrDetail("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      if (/BEGIN PGP PRIVATE KEY/i.test(text) || /BEGIN PRIVATE KEY/i.test(text)) {
        setErrDetail("refused: private key material");
        setFile(null);
        return;
      }
      setArmored(text);
      const m = text.match(/([A-F0-9]{16})\s*$/im);
      setFp(m ? m[1].toUpperCase() : "(server will fingerprint)");
    };
    reader.readAsText(f);
  };
  const install = async () => {
    if (!armored.trim()) return;
    setPhase("checking");
    setErrDetail("");
    if (onUpload) {
      onUpload({ file, armored, fingerprint: fp });
      setPhase("ok");
      setTimeout(() => onClose && onClose(), 300);
      return;
    }
    try {
      const res = await fetch("/api/pgp/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ armored: armored.trim(), label: file ? file.name : "" })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("idle");
        setErrDetail(j.error || "upload failed");
        return;
      }
      setPhase("ok");
      setFp(j.fingerprint16 || fp);
      setTimeout(() => onClose && onClose(), 500);
    } catch (e) {
      setPhase("idle");
      setErrDetail("network error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="UPLOAD · OpenPGP PUBLIC KEY" kind="KEY" status={phase === "checking" ? "UPLOAD" : phase.toUpperCase()}>
      <div className="mod-head-block">
        <div className="mod-icon warn"><span className="b1"></span><span className="b2"></span>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="14" r="4"/><line x1="11" y1="14" x2="22" y2="14"/><line x1="18" y1="14" x2="18" y2="18"/><line x1="22" y1="14" x2="22" y2="18"/></svg>
        </div>
        <div className="txt">
          <h2>Armored public key only.</h2>
          <p>Used to verify detached signatures on log posts. Stored in MongoDB; served under <code>/pgp/key/&lt;id&gt;.asc</code> and listed in <code>/pgp/keys.json</code>.</p>
        </div>
      </div>
      <div style={{ border: "1px dashed var(--accent)", padding: 24, textAlign: "center", background: "rgba(255,87,34,0.03)" }}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", marginBottom: 8 }}>▸ DROP .asc / .txt HERE</div>
        <div className="dim" style={{ fontSize: 11 }}>or</div>
        <label className="btn-sm primary" style={{ display: "inline-block", marginTop: 10, cursor: "pointer" }}>
          choose file
          <input type="file" accept=".asc,.txt,.pub" style={{ display: "none" }} onChange={(e) => onFile(e.target.files[0])} />
        </label>
        {file && <div className="dim" style={{ marginTop: 12, fontSize: 11 }}>{file.name} · {file.size}B</div>}
      </div>
      {fp && (
        <div className="fingerprint" style={{ marginTop: 16 }}>
          <div className="lbl">// FINGERPRINT</div>
          {fp}
        </div>
      )}
      {errDetail && <div className="auth-status err" style={{ marginTop: 12 }}>{errDetail}</div>}
      <div className="readonly-note" style={{ marginTop: 14 }}>
        Logged-in session required. Private OpenPGP blocks are rejected.
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">also linked from <code>/signing.pub</code> when no minisign key on disk</div>
        <div className="r">
          <button className="btn-sm" onClick={onClose}>cancel</button>
          <button className="btn-sm primary" disabled={!armored.trim() || phase === "checking"} onClick={install}>▸ UPLOAD KEY</button>
        </div>
      </div>
    </Modal>
  );
}

// ============ About ============
function AboutModal({ open, onClose, site }) {
  return (
    <Modal open={open} onClose={onClose} title="ABOUT · ELVISH" kind="META" status="v0.7.4-NIGHTLY" size="narrow">
      <div className="about-block">
        <div className="ascii">{`█▀▄ █▀▀ █▀█ █▀█ ▄▀█ █▀█\n█▀  ██▄ █▄█ █▀▀ █▀█ █▀▄\n     V A N T A`}</div>
        <p style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
          End-to-end encrypted mail with browser-held keys, OpenPGP interoperability, and zero-access storage. No ads. No tracking. AGPL-3.0.
        </p>
        <dl>
          <dt>Build</dt><dd>{site?.build_label || "nightly"} · {site?.build_date || "26.04.28"}</dd>
          <dt>Hash</dt><dd className="accent mono">{site?.hash_short || "d4f3a2c1"}</dd>
          <dt>License</dt><dd>{site?.license_line || "AGPL-3.0"}</dd>
          <dt>Runtime</dt><dd>edge · webassembly</dd>
          <dt>Modes</dt><dd>OpenPGP · Protected link · Relay</dd>
          <dt>Source</dt><dd className="accent">elvishserver · MongoDB · Valkey</dd>
        </dl>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l">// END OF FILE</div>
        <div className="r"><button className="btn-sm primary" onClick={onClose}>close</button></div>
      </div>
    </Modal>
  );
}

// ============ Toast / Notify (small modal-like) ============
function NotifyModal({ open, onClose, kind = "ok", title, body }) {
  const iconKind = kind === "warn" ? "warn" : kind === "err" ? "warn" : "ok";
  return (
    <Modal open={open} onClose={onClose} title={kind.toUpperCase()} kind="NOTIFY" status="" size="narrow">
      <div className="mod-head-block">
        <div className={"mod-icon " + iconKind}><span className="b1"></span><span className="b2"></span>
          {kind === "ok" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,12 10,18 20,6"/></svg>}
          {kind === "warn" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 L22 20 L2 20 Z"/><line x1="12" y1="10" x2="12" y2="15"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor"/></svg>}
          {kind === "err" && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>}
        </div>
        <div className="txt">
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </div>
      <div className="mod-foot" style={{ margin: "20px -24px -22px", borderTop: "1px solid var(--fg)" }}>
        <div className="l"></div>
        <div className="r"><button className="btn-sm primary" onClick={onClose}>ok</button></div>
      </div>
    </Modal>
  );
}

window.VModals = { Modal, ConfirmDestroyModal, ToolPreviewModal, CommandPaletteModal, ShortcutsModal, AuthModal, RegisterModal, LoginModal, PublishModal, SigningKeyModal, AboutModal, NotifyModal };
