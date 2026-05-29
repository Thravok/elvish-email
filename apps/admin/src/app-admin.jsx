// ELVISH admin — main app
import { AdminPanelLayout } from "../../../packages/elvish-ui/src/layout.jsx";
import { Button } from "../../../packages/elvish-ui/src/primitives.jsx";

const { useState: useS_app, useEffect: useE_app, useMemo: useM_app, useRef: useR_app } = React;

const devLog = (...args) => {
  if (typeof window.__elvishDevLog === "function") window.__elvishDevLog(...args);
};

/** Seeded from the HTML embed; live data arrives via GET /api/bootstrap.json (never localStorage). */
const __ADMIN_INITIAL__ = healAdminStateShape(window.ADMIN_STATE_INITIAL);

// Keys driven by content/home.json (+ metrics overlay); refreshed on every admin load from bootstrap.
const BOOTSTRAP_HOME_KEYS = [
  "site",
  "tweak_defaults",
  "nav",
  "footer",
  "hero",
  "terminal",
  "tools",
  "log_page",
  "ticker_home",
  "metrics",
  "support"
];

function healAdminStateShape(state) {
  const s = window.mergeAdminStateWithDefaults(state, window.ADMIN_STATE_INITIAL);
  if (Array.isArray(s.tools)) {
    s.tools = s.tools.map((t) => {
      const { monitors, health_href, ...rest } = t;
      let monitor = t.monitor && typeof t.monitor === "object" ? { ...t.monitor } : null;
      if (!monitor && Array.isArray(monitors) && monitors.length > 0) {
        monitor = { ...monitors[0] };
      }
      if (!monitor && health_href) {
        monitor = {
          id: "primary",
          enabled: true,
          name: "HTTP",
          type: "http",
          url: health_href,
          method: "GET",
          expect_status: []
        };
      }
      return { ...rest, monitor };
    });
  }
  return s;
}

function mergeServerBootstrap(prev, payload) {
  if (!payload || typeof payload !== "object") return prev;
  const keys = [...BOOTSTRAP_HOME_KEYS, "posts"];
  const next = { ...prev };
  for (const k of keys) {
    if (payload[k] !== undefined && payload[k] !== null) next[k] = payload[k];
  }
  // API payloads often send partial objects (e.g. site without blog_signing); shallow assign would break SecSite.
  return healAdminStateShape(next);
}

/** Keys sent to PUT /api/admin/site/home (must match server merge). */
function buildHomeAdminPayload(state) {
  const keys = ["site", "tweak_defaults", "nav", "footer", "hero", "terminal", "tools", "log_page", "ticker_home", "support"];
  const o = {};
  for (const k of keys) {
    if (state[k] !== undefined) o[k] = state[k];
  }
  return o;
}

const ADMIN_SECTION_DEFS = [
  {
    id: "site",
    num: "01",
    label: "Site / SEO",
    description: "Home bundle defaults, content blocks, and public presentation.",
    key: "SecSite",
    icon: "site"
  },
  {
    id: "users",
    num: "02",
    label: "Users",
    description: "Inspect accounts and take targeted moderation actions.",
    key: "SecUsers",
    icon: "users"
  },
  {
    id: "outbox",
    num: "03",
    label: "Outbox",
    description: "Track queued delivery, retries, and system/admin sends.",
    key: "SecOutbox",
    icon: "outbox"
  },
  {
    id: "domains",
    num: "04",
    label: "Domains",
    description: "Review mail domain readiness, routing, and verification state.",
    key: "SecDomains",
    icon: "globe"
  },
  {
    id: "testing",
    num: "05",
    label: "Testing",
    description: "Run probes and validate the mail transport pipeline.",
    key: "SecMailTest",
    icon: "testing"
  },
  {
    id: "system-mail",
    num: "06",
    label: "System Mail",
    description: "Compose and send operator notices through the platform outbox.",
    key: "SecSystemMail",
    icon: "mail"
  },
  {
    id: "telemetry",
    num: "07",
    label: "Telemetry",
    description: "Inspect anonymous operational signals and aggregated health data.",
    key: "SecTelemetry",
    icon: "telemetry"
  },
  {
    id: "performance",
    num: "08",
    label: "Performance",
    description: "Track latency, failures, queue health, and manual investigation exports.",
    key: "SecPerformance",
    icon: "performance"
  },
  {
    id: "platform",
    num: "09",
    label: "Platform",
    description: "Public URLs, mail domain, CORS, registration, paid tier, and performance tuning.",
    key: "SecPlatform",
    icon: "site",
    searchKeywords: ["platform", "cors", "cookie", "registration", "paid", "public url", "mail domain"]
  },
  {
    id: "auth-captcha",
    num: "10",
    label: "Cap · Login CAPTCHA",
    description: "Self-hosted Cap (trycap.dev): widget URL, secret, and /siteverify for /login and /register.",
    key: "SecAuthCaptcha",
    icon: "captcha",
    searchKeywords: ["cap", "captcha", "trycap", "login", "register", "siteverify", "widget", "srp"]
  },
  {
    id: "content",
    num: "11",
    label: "Content",
    description: "Nav, hero, tools, blog, and OpenPGP signing for the public site.",
    key: "SecContentHub",
    icon: "site",
    searchKeywords: ["nav", "footer", "hero", "blog", "tools", "ticker", "terminal", "pgp", "signing"]
  },
  {
    id: "uptime",
    num: "12",
    label: "Uptime",
    description: "Configure probe intervals, endpoints, and run history for site monitoring.",
    key: "SecUptime",
    icon: "performance",
    searchKeywords: ["uptime", "probe", "monitor", "health"]
  }
];

const ADMIN_DIFF_KEYS = [
  "site",
  "nav",
  "footer",
  "hero",
  "terminal",
  "tools",
  "log_page",
  "ticker_home",
  "support",
  "tweak_defaults"
];

function buildAdminDiff(savedJson, currentState) {
  let prev = {};
  try {
    prev = JSON.parse(savedJson);
  } catch (_) {
    return [{ kind: "mod", scope: "state", path: "saved snapshot unreadable · full save" }];
  }
  const rows = [];
  for (const k of ADMIN_DIFF_KEYS) {
    let a = "";
    let b = "";
    try {
      a = JSON.stringify(prev[k]);
      b = JSON.stringify(currentState[k]);
    } catch (_) {
      b = "err";
    }
    if (a !== b) {
      rows.push({ kind: "mod", scope: k, path: "admin bundle · differs from last saved" });
    }
  }
  if (rows.length === 0) {
    rows.push({ kind: "mod", scope: "state", path: "working copy · unsaved (snapshot mismatch)" });
  }
  return rows;
}

const ADMIN_COMMANDS = [
  { id: "goto.site", name: "Goto · Site / SEO", scope: "ADMIN", glyph: "▸", shortcut: "g s" },
  { id: "goto.users", name: "Goto · Users", scope: "ADMIN", glyph: "▸", shortcut: "g u" },
  { id: "goto.outbox", name: "Goto · Outbox", scope: "ADMIN", glyph: "▸", shortcut: "g o" },
  { id: "goto.domains", name: "Goto · Domains", scope: "ADMIN", glyph: "▸", shortcut: "g d" },
  { id: "goto.testing", name: "Goto · Testing", scope: "ADMIN", glyph: "▸", shortcut: "g t" },
  { id: "goto.system-mail", name: "Goto · System mail", scope: "ADMIN", glyph: "▸" },
  { id: "goto.telemetry", name: "Goto · Telemetry", scope: "ADMIN", glyph: "▸" },
  { id: "goto.performance", name: "Goto · Performance", scope: "ADMIN", glyph: "▸" },
  { id: "goto.auth-captcha", name: "Goto · Cap / Login CAPTCHA", scope: "ADMIN", glyph: "▸", shortcut: "g c" },
  { id: "goto.content", name: "Goto · Content", scope: "ADMIN", glyph: "▸" },
  { id: "goto.uptime", name: "Goto · Uptime", scope: "ADMIN", glyph: "▸" },
  { id: "commit", name: "Save site bundle (MongoDB)", scope: "STATE", glyph: "▸", shortcut: "⌘S" },
  { id: "about", name: "About ELVISH", scope: "META", glyph: "▸" },
  { id: "auth.login", name: "Login (modal)", scope: "AUTH", glyph: "▸" },
  { id: "auth.register", name: "Register (modal)", scope: "AUTH", glyph: "▸" }
];

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error("[elvish admin] componentDidCatch", err, info && info.componentStack);
  }
  render() {
    if (this.state.err) {
      const msg = String((this.state.err && this.state.err.stack) || this.state.err || "unknown error");
      return (
        <div style={{ padding: 24, maxWidth: 720, margin: "40px auto", fontFamily: "ui-monospace, monospace", color: "var(--fg,#111)" }}>
          <h1 style={{ fontSize: 16, marginBottom: 12 }}>Admin panel crashed</h1>
          <pre style={{ fontSize: 11, overflow: "auto", whiteSpace: "pre-wrap", border: "1px solid", padding: 12 }}>{msg}</pre>
          <p style={{ fontSize: 12, marginTop: 16, opacity: 0.75 }}>Reload the page. If this persists, check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminApp({ embedded, onLeaveEmbedded } = {}) {
  const sections = useM_app(() => {
    return ADMIN_SECTION_DEFS.map((s) => {
      const Comp = window[s.key];
      const Resolved = typeof Comp === "function" ? Comp : function AdminSectionMissing() {
        return (
          <div className="adm-page" style={{ padding: 24 }}>
            <div className="ftk">// LOAD ERROR</div>
            <p style={{ marginTop: 8 }}>
              Missing component <code>{s.key}</code> for section <code>{s.id}</code>. Check the console and mail-admin-embed bundle load order.
            </p>
          </div>
        );
      };
      return {
        id: s.id,
        label: s.label,
        description: s.description,
        icon: s.icon,
        badge: s.num,
        testId: "admin-nav-" + s.id,
        searchKeywords: s.searchKeywords,
        Comp: Resolved
      };
    });
  }, []);

  // theme + tweaks (same as site). Embedded /mail panel skips extra grid layers and does not
  // override documentElement — the mail shell owns page-level data-theme / data-font.
  const T = window.useTweaks(
    embedded
      ? { theme: "dark", font: "ibm", scanlines: false, showGrid: false }
      : { theme: "dark", font: "ibm", scanlines: false, showGrid: true }
  );
  const [tweak, setTweak] = T;

  useE_app(() => {
    if (embedded) return undefined;
    document.documentElement.setAttribute("data-theme", tweak.theme);
    document.documentElement.setAttribute("data-font", tweak.font);
    return undefined;
  }, [tweak.theme, tweak.font, embedded]);

  useE_app(() => {
    devLog("AdminApp mounted");
    if (window.ElvishPerf) {
      window.ElvishPerf.observePaint("admin_ui");
      window.ElvishPerf.recordSinceNavigation("admin_ui", "page_boot", "success");
    }
  }, []);

  // pinned state
  const [state, setState] = useS_app(() => __ADMIN_INITIAL__);
  const [savedSnapshot, setSavedSnapshot] = useS_app(() => JSON.stringify(__ADMIN_INITIAL__));
  const [persistHome, setPersistHome] = useS_app(false);
  const dirty = useM_app(() => JSON.stringify(state) !== savedSnapshot, [state, savedSnapshot]);

  useE_app(() => {
    try {
      localStorage.removeItem("elvish-admin-state");
    } catch (_) {
      /* ignore */
    }
  }, []);

  useE_app(() => {
    let cancelled = false;
    const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    (async () => {
      try {
        devLog("admin bootstrap: GET /api/bootstrap.json");
        const r = await fetch(elvishApiUrl("/api/bootstrap.json"), { cache: "no-store" });
        if (!r.ok || cancelled) {
          devLog("admin bootstrap: no JSON (offline or 404)", r.status, "cancelled=", cancelled);
          return;
        }
        const payload = await r.json();
        devLog("admin bootstrap: OK keys=", Object.keys(payload || {}));
        setPersistHome(!!payload.persist_home);
        setState((prev) => {
          const next = mergeServerBootstrap(prev, payload);
          Promise.resolve().then(() => {
            if (!cancelled) setSavedSnapshot(JSON.stringify(next));
          });
          return next;
        });
        if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "bootstrap_fetch", perfStartedAt, "success");
      } catch (err) {
        devLog("admin bootstrap: fetch error", err);
        if (window.ElvishPerf) window.ElvishPerf.end("admin_ui", "bootstrap_fetch", perfStartedAt, "failure");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [active, setActive] = useS_app(() => location.hash.replace("#", "") || "site");
  const mainRef = useR_app(null);
  const perfInitialSectionRef = useR_app(true);
  useE_app(() => {
    const onHash = () => setActive(location.hash.replace("#", "") || "site");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goto = (id) => { location.hash = id; setActive(id); window.scrollTo(0, 0); };

  useE_app(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [active]);
  useE_app(() => {
    if (!window.ElvishPerf) return;
    if (perfInitialSectionRef.current) {
      perfInitialSectionRef.current = false;
      return;
    }
    window.ElvishPerf.record("admin_ui", "section_switch", 1, "success");
  }, [active]);

  const sec = sections.find((s) => s.id === active) || sections[0];
  const Comp = sec.Comp;

  const M = window.VModals;
  const [cmdpOpen, setCmdpOpen] = useS_app(false);
  const [dialog, setDialog] = useS_app(null);
  const [notify, setNotify] = useS_app(null);
  const closeDialog = () => setDialog(null);

  const publishDiff = useM_app(() => buildAdminDiff(savedSnapshot, state), [savedSnapshot, state]);

  const markAdminSynced = (msgNote) => {
    setSavedSnapshot(JSON.stringify(state));
    const body = msgNote && String(msgNote).trim()
      ? String(msgNote).trim().slice(0, 240)
      : "Site home JSON updated in MongoDB.";
    setNotify({ kind: "ok", title: "Saved", body });
  };

  const requestSave = () => {
    if (dirty) setDialog("publish");
    else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
  };

  const runCommand = (c) => {
    const id = c.id;
    if (id.startsWith("goto.")) {
      const secId = id.replace("goto.", "");
      if (sections.some((s) => s.id === secId)) goto(secId);
      return;
    }
    if (id === "commit") {
      if (dirty) setDialog("publish");
      else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
      return;
    }
    if (id === "about") {
      setDialog("about");
      return;
    }
    if (id === "auth.login") {
      setDialog("login");
      return;
    }
    if (id === "auth.register") {
      setDialog("register");
      return;
    }
    if (id === "log.open") {
      window.open("/log/", "_blank", "noopener,noreferrer");
    }
  };

  useE_app(() => {
    const onKey = (e) => {
      const t = e.target && e.target.tagName;
      const editable =
        t === "INPUT" ||
        t === "TEXTAREA" ||
        t === "SELECT" ||
        (e.target && e.target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault();
        setCmdpOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) setDialog("publish");
        else setNotify({ kind: "ok", title: "In sync", body: "No unsaved changes." });
        return;
      }
      if (e.key === "?" && !editable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCmdpOpen(false);
        setDialog("shortcuts");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty]);

  const site = state.site || {};
  const siteVersion = (site.version && String(site.version).trim()) || "0.7.4";
  const siteBuildLabel = (site.build_label && String(site.build_label).trim()) || "nightly";

  return (
    <>
      {!embedded && tweak.showGrid && <div className="bg-grid"></div>}
      {!embedded && tweak.scanlines && <div className="scanline"></div>}

      <div className="frame" data-testid="admin-root" data-admin-embedded={embedded ? "1" : undefined}>
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <a href="/" className="admin-brand">
              <span className="admin-brand-dot"></span>ELVISH
            </a>
            <span className="admin-brand-sep">/</span>
            <span className="admin-brand-section">ADMIN</span>
          </div>
          <div className="admin-topbar-center">
            <div className={`admin-topbar-status ${dirty ? "unsaved" : "synced"}`}>
              {dirty ? "● UNSAVED" : "● SYNCED"}
            </div>
            {persistHome && (
              <div className="admin-topbar-status synced">
                MONGO
              </div>
            )}
          </div>
          <div className="admin-topbar-right">
            {embedded && typeof onLeaveEmbedded === "function" ? (
              <button type="button" className="admin-topbar-link" onClick={onLeaveEmbedded}>
                INBOX
              </button>
            ) : (
              <a href="/mail" className="admin-topbar-link">MAIL</a>
            )}
            <a href="/" className="admin-topbar-link">SITE</a>
            <button
              type="button"
              className="admin-topbar-save"
              disabled={!dirty}
              onClick={requestSave}
            >
              {dirty ? "SAVE CHANGES" : "IN SYNC"}
            </button>
          </div>
        </header>

        <div className="admin-shell" data-testid="admin-shell">
          <AdminPanelLayout
            shellClassName="admin-settings-shell"
            title="Admin panel"
            sections={sections}
            activeSection={active}
            onSectionChange={(id) => goto(id)}
            showDescriptions
            searchPlaceholder="Search sections..."
            searchInputAriaLabel="Search admin sections"
            navAriaLabel="Admin sections"
            emptySearchTitle="No matching sections"
            emptySearchDescription="Try a different keyword or clear the search to see the full admin navigation."
            meta={[
              "v" + siteVersion,
              siteBuildLabel,
              ...(persistHome ? ["Mongo sync"] : []),
            ]}
            footerState={{
              variant: dirty ? "unsaved" : "synced",
              text: dirty ? "Unsaved changes in working copy." : "Everything is in sync.",
            }}
            footerActions={
              <>
                <Button variant="primary" size="sm" disabled={!dirty} onClick={requestSave}>
                  Save changes
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDialog("reset")}>
                  Reset copy
                </Button>
              </>
            }
            footer={
              <div className="adm-side-foot-links">
                <a href="/login">login</a>
                <span className="adm-side-foot-dot"> · </span>
                <a href="/register">register</a>
              </div>
            }
            mainClassName="admin-settings-main"
            mainContentRef={mainRef}
            wideLayout
          >
            <div className="adm-page">
              <Comp state={state} set={setState} dirty={dirty} onPublish={requestSave} />
            </div>
          </AdminPanelLayout>
        </div>

        <window.TweaksPanel title="TWEAKS">
          <window.TweakSection title="Appearance">
            <window.TweakRadio label="Theme" value={tweak.theme} onChange={(v) => setTweak("theme", v)}
              options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
            <window.TweakSelect label="Font" value={tweak.font} onChange={(v) => setTweak("font", v)} options={window.TWEAK_FONT_OPTIONS} />
          </window.TweakSection>
          <window.TweakSection title="Effects">
            <window.TweakToggle label="Background grid" value={tweak.showGrid} onChange={(v) => setTweak("showGrid", v)} />
            <window.TweakToggle label="Scanlines"       value={tweak.scanlines} onChange={(v) => setTweak("scanlines", v)} />
          </window.TweakSection>
          <window.TweakSection title="Modals">
            <window.TweakButton label="Command palette (⌘K)" onClick={() => setCmdpOpen(true)} />
            <window.TweakButton label="Keyboard shortcuts (?)" onClick={() => { setCmdpOpen(false); setDialog("shortcuts"); }} />
            <window.TweakButton label="About" onClick={() => { setCmdpOpen(false); setDialog("about"); }} />
          </window.TweakSection>
        </window.TweaksPanel>
      </div>

      {M && (
        <>
          <M.CommandPaletteModal
            open={cmdpOpen}
            onClose={() => setCmdpOpen(false)}
            commands={ADMIN_COMMANDS}
            onRun={(c) => {
              setCmdpOpen(false);
              runCommand(c);
            }}
          />
          <M.ShortcutsModal open={dialog === "shortcuts"} onClose={closeDialog} />
          <M.PublishModal
            open={dialog === "publish"}
            onClose={closeDialog}
            diff={publishDiff}
            dirty={dirty}
            persistHome={persistHome}
            initialNotes=""
            onCommitLocal={(p) => {
              markAdminSynced(p && p.msg);
            }}
            onSaveMongo={
              persistHome
                ? async () => {
                    const r = await fetch(elvishApiUrl("/api/admin/site/home"), {
                      method: "PUT",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(buildHomeAdminPayload(state))
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
                  }
                : null
            }
          />
          <M.ConfirmDestroyModal
            open={dialog === "reset"}
            onClose={closeDialog}
            label="RESET"
            phrase="RESET"
            target={{
              name: "ADMIN WORKING COPY",
              path: "in-memory only (not written to SQL until you save)",
              detail: "All sections revert to the HTML seed for this build; reload to pull bootstrap again."
            }}
            onConfirm={() => {
              setState(window.ADMIN_STATE_INITIAL);
              setSavedSnapshot(JSON.stringify(window.ADMIN_STATE_INITIAL));
              setNotify({ kind: "ok", title: "Reset complete", body: "Defaults restored." });
            }}
          />
          <M.AboutModal open={dialog === "about"} onClose={closeDialog} site={state.site} />
          <M.LoginModal
            open={dialog === "login"}
            onClose={closeDialog}
            onDone={() => {
              window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
              setNotify({ kind: "ok", title: "Logged in", body: "Session cookie set." });
            }}
          />
          <M.RegisterModal
            open={dialog === "register"}
            onClose={closeDialog}
            onDone={() => {
              window.dispatchEvent(new CustomEvent("elvish:sessionChanged"));
              setNotify({ kind: "ok", title: "Registered", body: "Session cookie set." });
            }}
          />
          <M.NotifyModal
            open={!!notify}
            onClose={() => setNotify(null)}
            kind={notify?.kind}
            title={notify?.title}
            body={notify?.body}
          />
        </>
      )}
    </>
  );
}

function ElvishMailAdminPanel(props) {
  return (
    <AdminErrorBoundary>
      <AdminApp embedded={!!(props && props.embedded)} onLeaveEmbedded={props && props.onLeaveEmbedded} />
    </AdminErrorBoundary>
  );
}
window.ElvishMailAdminPanel = ElvishMailAdminPanel;
