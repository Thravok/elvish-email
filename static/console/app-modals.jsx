// ELVISH modals — demo gallery
const { useState: useS_g } = React;

function GalleryApp() {
  const T = window.useTweaks({ "theme": "dark", "font": "ibm", "showGrid": true });
  const [tweak, setTweak] = T;
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweak.theme);
    document.documentElement.setAttribute("data-font", tweak.font);
  }, [tweak.theme, tweak.font]);

  const [openId, setOpenId] = useS_g(null);
  const [notif, setNotif] = useS_g(null);
  const close = () => setOpenId(null);

  const SAMPLE_TOOL = window.ADMIN_STATE_INITIAL.tools[0];

  const COMMANDS = [
    { id: "goto.site",   name: "Goto · Site / SEO",   scope: "ADMIN", glyph: "▸", shortcut: "g s" },
    { id: "goto.tools",  name: "Goto · Tools",        scope: "ADMIN", glyph: "▸", shortcut: "g t" },
    { id: "goto.posts",  name: "Goto · Blog posts",   scope: "ADMIN", glyph: "▸", shortcut: "g p" },
    { id: "post.new",    name: "New blog post",       scope: "POSTS", glyph: "+", shortcut: "⌘N" },
    { id: "tool.new",    name: "New tool",            scope: "TOOLS", glyph: "+", shortcut: "⌘⇧N" },
    { id: "build.run",   name: "Run elvishserver",     scope: "BUILD", glyph: "▸" },
    { id: "build.deploy",name: "Publish to live API", scope: "BUILD", glyph: "▸" },
    { id: "commit",      name: "Save site changes",   scope: "SITE",  glyph: "▸", shortcut: "⌘S" },
    { id: "key.upload",  name: "Upload signing.pub",  scope: "KEYS",  glyph: "⊹" },
    { id: "open.shroud", name: "Open SHROUD",         scope: "TOOLS", glyph: "→" },
    { id: "open.cipher", name: "Open CIPHER-0",       scope: "TOOLS", glyph: "→" },
    { id: "open.tessera",name: "Open TESSERA",        scope: "TOOLS", glyph: "→" }
  ];

  const DIFF = [
    { kind: "mod", scope: "site",    path: "content/home.json · site.title" },
    { kind: "mod", scope: "site",    path: "content/home.json · site.description" },
    { kind: "add", scope: "tools",   path: "content/home.json · tools[12] (echo)" },
    { kind: "mod", scope: "tools",   path: "content/home.json · tools[3].desc" },
    { kind: "add", scope: "posts",   path: "content/blog/26-04-28-v074-quieter-logs.md" },
    { kind: "del", scope: "posts",   path: "content/blog/26-05-03-v080-draft.md (was draft)" },
    { kind: "mod", scope: "metrics", path: "content/blog/metrics.json · against-the-dashboard" },
    { kind: "mod", scope: "log",     path: "content/home.json · log_page.intro_markdown" }
  ];

  const M = window.VModals;

  const cards = [
    { id: "preview",  t: "Tool Preview",        d: "Read-only spec card for a tool." },
    { id: "confirm",  t: "Confirm · Destroy",   d: "Type-to-confirm destructive action." },
    { id: "cmdp",     t: "Command Palette",     d: "⌘K — fuzzy run anything." },
    { id: "shortcuts",t: "Shortcuts",           d: "All keyboard bindings." },
    { id: "auth",     t: "Re-authenticate",     d: "Confirm password for sensitive actions." },
    { id: "register", t: "Register",            d: "Create operator account (Mongo + Valkey)." },
    { id: "login",    t: "Login",               d: "Sign in for /api session." },
    { id: "publish",  t: "Publish · Diff",      d: "Review changes before saving to the live API." },
    { id: "key",      t: "OpenPGP key upload",  d: "Armored public key → MongoDB /pgp/." },
    { id: "about",    t: "About",               d: "Version, hash, license." },
    { id: "notify",   t: "Notify",              d: "ok / warn / err toast modal." }
  ];

  return (
    <>
      {tweak.showGrid && <div className="bg-grid"></div>}
      <div className="frame">
        <window.Topbar active="modals" />

        <section className="manifesto">
          <div>
            <div className="section-label"><span className="index">§ MOD</span> SYSTEM <span className="rule"></span></div>
            <h1 style={{ marginTop: 18 }}>
              MODAL <span className="stripe">SET</span><br/>
              FOR THE WHOLE<br/>
              SURFACE.
            </h1>
            <p>Nine modals tuned to actual ELVISH flows: previewing tools, destructive confirm, ⌘K palette, shortcut help, sudo, commit-PR with diff, signing-key upload, about card, notify.</p>
            <p style={{ color: "var(--accent)", marginTop: 8 }}>// click any tile · esc to close · ⌘K from anywhere</p>
          </div>
          <div className="bracket" style={{ padding: 14, position: "relative" }}>
            <span className="br-bl"></span><span className="br-br"></span>
            <div className="ftk" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--dim)", marginBottom: 8 }}>// SHARED CHROME</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
              <li><span className="dim">▸</span> Corner brackets · accent</li>
              <li><span className="dim">▸</span> 4-cell title bar (kind · title · status · ×)</li>
              <li><span className="dim">▸</span> Backdrop with fine grid overlay</li>
              <li><span className="dim">▸</span> Drop-shadow at 16/16 in accent @ 18%</li>
              <li><span className="dim">▸</span> Esc dismiss · click-outside dismiss</li>
              <li><span className="dim">▸</span> Foot bar with helper kbd hints</li>
            </ul>
          </div>
        </section>

        <div className="tools-grid" style={{ borderTop: "1px solid var(--fg)" }}>
          {cards.map((c, i) => (
            <article key={c.id} className="tool-card active" onClick={() => setOpenId(c.id)} style={{ cursor: "pointer" }}>
              <span className="cb tl"></span><span className="cb tr"></span><span className="cb bl"></span><span className="cb br"></span>
              <header className="tc-head">
                <div className="tc-head-l">
                  <span className="tc-id">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tc-slash">/</span>
                  <span className="tc-name">{c.t}</span>
                </div>
                <span className="tag live">modal</span>
              </header>
              <div className="tc-body">
                <p className="tc-desc">{c.d}</p>
                <hr/>
                <div className="tc-foot">
                  <span className="dim tiny">CLICK TO OPEN</span>
                  <span className="tc-launch"><span>SHOW</span><span className="arr">→</span></span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="ticker" style={{ marginTop: 16 }}>
          <div className="ticker-track">
            <span>ESC TO CLOSE</span><span>⌘K · COMMAND PALETTE</span><span>? · SHORTCUTS</span>
            <span>SIGNED BY ANON</span><span>NO TRACKERS IN MODALS</span><span>BRUTALIST</span>
            <span>ESC TO CLOSE</span><span>⌘K · COMMAND PALETTE</span><span>? · SHORTCUTS</span>
            <span>SIGNED BY ANON</span><span>NO TRACKERS IN MODALS</span><span>BRUTALIST</span>
          </div>
        </div>

        <window.Footer />

        <window.TweaksPanel title="TWEAKS">
          <window.TweakSection title="Appearance">
            <window.TweakRadio label="Theme" value={tweak.theme} onChange={(v) => setTweak("theme", v)}
              options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
            <window.TweakSelect label="Font" value={tweak.font} onChange={(v) => setTweak("font", v)} options={window.TWEAK_FONT_OPTIONS} />
            <window.TweakToggle label="Background grid" value={tweak.showGrid} onChange={(v) => setTweak("showGrid", v)} />
          </window.TweakSection>
          <window.TweakSection title="Open modal directly">
            {cards.map(c => <window.TweakButton key={c.id} label={c.t} onClick={() => setOpenId(c.id)} />)}
          </window.TweakSection>
        </window.TweaksPanel>
      </div>

      {/* MODALS */}
      <M.ToolPreviewModal     open={openId === "preview"}   onClose={close} tool={SAMPLE_TOOL} />
      <M.ConfirmDestroyModal  open={openId === "confirm"}   onClose={close}
                              target={{ name: "OBSCURA", path: "content/home.json · tools[10]", detail: "live tool · 1.4M calls · removing will 410 the slug." }}
                              phrase="DELETE"
                              onConfirm={() => setNotif({ kind: "warn", title: "Queued for removal", body: "OBSCURA will be removed on next commit." })} />
      <M.CommandPaletteModal  open={openId === "cmdp"}      onClose={close} commands={COMMANDS}
                              onRun={(c) => setNotif({ kind: "ok", title: "Ran · " + c.name, body: "scope: " + c.scope })} />
      <M.ShortcutsModal       open={openId === "shortcuts"} onClose={close} />
      <M.AuthModal            open={openId === "auth"}      onClose={close}
                              onAuth={(u) => setNotif({ kind: "ok", title: "Authorized", body: "Welcome, " + u.user + "." })} />
      <M.RegisterModal        open={openId === "register"}   onClose={close}
                              onDone={() => {
                                setNotif({ kind: "ok", title: "Registered", body: "Session cookie set." });
                                window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
                              }} />
      <M.LoginModal           open={openId === "login"}      onClose={close}
                              onDone={() => {
                                setNotif({ kind: "ok", title: "Logged in", body: "Session cookie set." });
                                window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
                              }} />
      <M.PublishModal         open={openId === "publish"}   onClose={close} diff={DIFF} dirty={true} persistHome={false}
                              onCommitLocal={(c) => setNotif({ kind: "ok", title: "PR opened", body: c.signed ? "Signed commit pushed to main." : "Commit pushed (unsigned)." })} />
      <M.SigningKeyModal      open={openId === "key"}       onClose={close}
                              onUpload={() => setNotif({ kind: "ok", title: "Key installed", body: "Will deploy to /signing.pub on next build." })} />
      <M.AboutModal           open={openId === "about"}     onClose={close} site={window.ADMIN_STATE_INITIAL.site} />
      <M.NotifyModal          open={openId === "notify"}    onClose={close}
                              kind="warn" title="Unsaved changes" body="You have unsaved edits. Publish saves to the live API when wired, or discard from /admin." />

      {/* notify channel */}
      <M.NotifyModal open={!!notif} onClose={() => setNotif(null)} kind={notif?.kind} title={notif?.title} body={notif?.body} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<GalleryApp />);
