// ELVISH — shared public topbar component
// Fetches nav from /api/site/topbar.json and auth from /api/auth/me

import React from "react";
const { useState, useEffect } = React;

function defaultTopbarLabel(me) {
  if (!me || typeof me !== "object") return "";
  if (me.name && String(me.name).trim()) return me.name;
  return me.email || me.username || "";
}

function renderDefaultTopbarAuth({ me, loggedIn, label, logoutNext, loginHref, registerHref, showMailLink }) {
  if (me === null) {
    return <span className="dim" style={{ fontSize: 10 }}>…</span>;
  }
  if (loggedIn) {
    return (
      <>
        <span className="nav-session dim" title={me.email || ""}>{label}</span>
        {me.is_admin && <a href="/admin/" className="navlink">PANEL</a>}
        {showMailLink && <a href="/mail" className="navlink">MAIL</a>}
        <form className="nav-inline-form" action="/auth/logout" method="post">
          <input type="hidden" name="next" value={logoutNext} />
          <button type="submit" className="navlink">LOGOUT</button>
        </form>
      </>
    );
  }
  return (
    <>
      <a href={loginHref} className="navlink">LOGIN</a>
      <a href={registerHref} className="navlink">REGISTER</a>
    </>
  );
}

function ElvishPublicTopbar({
  activeNavId,
  centerAfterNav,
  rightBeforeUtc,
  authContent,
  meOverride,
  logoutNext,
  loginHref = "/login",
  registerHref = "/register",
  showMailLink = true,
}) {
  const [nav, setNav] = useState(null);
  const [fetchedMe, setFetchedMe] = useState(null);
  const [time, setTime] = useState(() => new Date());

  const loadMe = () => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        if (j && j.user) setFetchedMe(j.user);
        else setFetchedMe(false);
      })
      .catch(() => setFetchedMe(false));
  };

  useEffect(() => {
    fetch("/api/site/topbar.json")
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j) {
          setNav(j.nav || []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (meOverride !== undefined) return undefined;
    loadMe();
    const onSessionChanged = () => loadMe();
    window.addEventListener("elvish:sessionChanged", onSessionChanged);
    return () => window.removeEventListener("elvish:sessionChanged", onSessionChanged);
  }, [meOverride]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const me = meOverride === undefined ? fetchedMe : meOverride;
  const t = time.toISOString().replace("T", " ").slice(0, 19) + "Z";
  const loggedIn = me && me !== false && typeof me === "object";
  const label = loggedIn ? defaultTopbarLabel(me) : "";
  const resolvedLogoutNext = logoutNext || window.location.pathname;
  const authInner =
    typeof authContent === "function"
      ? authContent({ me, loggedIn, label, logoutNext: resolvedLogoutNext })
      : authContent !== undefined
        ? authContent
        : renderDefaultTopbarAuth({
            me,
            loggedIn,
            label,
            logoutNext: resolvedLogoutNext,
            loginHref,
            registerHref,
            showMailLink,
          });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="dot"></span>ELVISH
        </a>
      </div>
      <nav className="topbar-center" aria-label="Main navigation">
        {nav && nav.map((n) => (
          <a
            key={n.id}
            href={n.href}
            className={"navlink" + (activeNavId === n.id ? " active" : "")}
            aria-current={activeNavId === n.id ? "page" : undefined}
          >
            {n.label}
          </a>
        ))}
        {centerAfterNav}
      </nav>
      <div className="topbar-right">
        {authInner !== null && authInner !== false && (
          <div className="topbar-auth">{authInner}</div>
        )}
        {rightBeforeUtc}
        <span className="dim">UTC</span>
        <span id="topbar-utc">{t}</span>
        <span className="tick">●</span>
      </div>
    </header>
  );
}

window.ElvishPublicTopbar = ElvishPublicTopbar;
