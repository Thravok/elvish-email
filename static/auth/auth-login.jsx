// ELVISH — /login
const { useState, useEffect } = React;

/** Same rules as server safeRedirectPath: relative path only, reject scheme-relative //… */
function safeClientRedirectPath(next) {
  if (typeof next !== "string") return "";
  next = next.trim();
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
  if (/[\r\n\x00\\]/.test(next) || next.includes("://")) return "";
  try {
    const u = new URL(next, window.location.origin);
    if (u.origin !== window.location.origin) return "";
    const p = u.pathname;
    if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "";
    return p + u.search + u.hash;
  } catch {
    return "";
  }
}

function assignClientRedirect(next, fallback) {
  const fb = safeClientRedirectPath(fallback) || "/mail";
  const dest = safeClientRedirectPath(next) || fb;
  window.location.assign(dest);
}

function applyClientThemeFromUser(user) {
  if (!user || !user.ui_theme) return;
  const raw = String(user.ui_theme);
  document.documentElement.setAttribute("data-user-ui-theme", raw);
  const resolved =
    raw === "dark" || raw === "light"
      ? raw
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-preference", raw);
}

function LoginPage() {
  const [username, setUsername] = useState("");
  const [mailDomain, setMailDomain] = useState("");
  const [password, setPassword] = useState("");
  const [rememberTrustedDevice, setRememberTrustedDevice] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [msg, setMsg] = useState("");
  const [nextOk, setNextOk] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMethod, setMfaMethod] = useState("totp");
  const [capWidgetURL, setCapWidgetURL] = useState("");
  const [capToken, setCapToken] = useState("");

  const CapField = window.AuthCapField;

  useEffect(() => {
    if (window.ElvishPerf) {
      window.ElvishPerf.observePaint("auth_ui");
      window.ElvishPerf.recordSinceNavigation("auth_ui", "page_boot", "success");
    }
    try {
      const raw = new URLSearchParams(window.location.search).get("next");
      setNextOk(safeClientRedirectPath(raw || ""));
    } catch {
      setNextOk("");
    }
  }, []);

  useEffect(() => {
    fetch(elvishApiUrl("/api/auth/signup-config"))
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        setMailDomain(typeof j.mail_domain === "string" ? j.mail_domain : "");
        const c = j.cap;
        if (c && c.enabled === true && typeof c.widget_api_endpoint === "string" && c.widget_api_endpoint.trim()) {
          setCapWidgetURL(c.widget_api_endpoint.trim());
        } else {
          setCapWidgetURL("");
          setCapToken("");
        }
      })
      .catch(() => {
        setMailDomain("");
        setCapWidgetURL("");
      });
  }, []);

  async function finalizeLogin(result, u, pass) {
    if (result && result.user) {
      applyClientThemeFromUser(result.user);
    }
    try {
      if (typeof window.ElvishKeyVault !== "undefined" && typeof window.ElvishKeygen !== "undefined") {
        const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
        setMsg("Unlocking encryption keys…");
        const meRes = await fetch(elvishApiUrl("/api/v1/account-key/me"), { credentials: "include" });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.bootstrapped) {
            const sessionEmail = (result.user && result.user.email) || (mailDomain ? `${u}@${mailDomain}` : "");
            await window.ElvishKeyVault.unlockAccount(me, pass, { sessionEmail });
          }
        }
        if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "key_unlock", perfStartedAt, "success");
      }
    } catch (e) {
      if (window.ElvishPerf) window.ElvishPerf.record("auth_ui", "key_unlock", 0, "failure");
      setMsg("Logged in (keys not unlocked: " + ((e && e.message) || e) + ")");
    }
    if (typeof window.ElvishKeyVault !== "undefined" && typeof window.ElvishKeyVault.setTrustedDevice === "function") {
      window.ElvishKeyVault.setTrustedDevice(!!rememberTrustedDevice);
    }
    setPhase("ok");
    setChallenge(null);
    setMsg((state) => state || "Redirecting…");
    assignClientRedirect(nextOk, "/mail");
  }

  async function submitLegacyLogin(u, pass) {
    const body = { username: u, password: pass };
    if (capWidgetURL) {
      body.cap_token = capToken.trim();
    }
    const res = await fetch(elvishApiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Login failed");
    return j;
  }

  async function submitPrimaryLogin(e) {
    e.preventDefault();
    setMsg("");
    const u = username.trim().toLowerCase();
    if (!u || !password) {
      setMsg("Username and password are required.");
      return;
    }
    if (capWidgetURL && !capToken.trim()) {
      setMsg("Complete the human verification challenge first.");
      return;
    }
    setPhase("loading");
    setMsg("Authenticating your session…");
    const perfStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    try {
      let result;
      try {
        if (!window.ElvishSRP) throw new Error("SRP subsystem not loaded");
        const beginExtra = capWidgetURL ? { cap_token: capToken.trim() } : undefined;
        result = await window.ElvishSRP.exchange(
          elvishApiUrl("/api/auth/login/begin"),
          elvishApiUrl("/api/auth/login/finish"),
          u,
          password,
          undefined,
          beginExtra
        );
      } catch (_) {
        result = await submitLegacyLogin(u, password);
      }
      if (result && result.mfa_required) {
        if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "login_exchange", perfStartedAt, "success");
        const methods = Array.isArray(result.methods) ? result.methods : [];
        setChallenge(result);
        setMfaCode("");
        setMfaMethod(methods.includes("totp") ? "totp" : methods.includes("webauthn") ? "webauthn" : "recovery");
        setPhase("mfa");
        setMsg("Two-factor authentication required.");
        return;
      }
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "login_exchange", perfStartedAt, "success");
      await finalizeLogin(result, u, password);
    } catch (err) {
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "login_exchange", perfStartedAt, "failure");
      setPhase("idle");
      setMsg((err && err.message) || "Login failed");
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!challenge || !challenge.challenge_id) return;
    if (!mfaCode.trim()) {
      setMsg("Enter your authentication code.");
      return;
    }
    setPhase("mfa_loading");
    setMsg(mfaMethod === "recovery" ? "Checking recovery code…" : "Checking authenticator code…");
    try {
      const endpoint = mfaMethod === "recovery" ? "/api/auth/2fa/login/recovery" : "/api/auth/2fa/login/totp";
      const res = await fetch(elvishApiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code: mfaCode.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Verification failed");
      await finalizeLogin(j, username.trim().toLowerCase(), password);
    } catch (err) {
      setPhase("mfa");
      setMsg((err && err.message) || "Verification failed");
    }
  }

  async function useSecurityKey() {
    if (!challenge || !challenge.challenge_id || !window.ElvishWebAuthn) {
      setMsg("Security key support is unavailable.");
      return;
    }
    setPhase("mfa_loading");
    setMsg("Waiting for your security key…");
    try {
      const beginRes = await fetch(elvishApiUrl("/api/auth/2fa/login/webauthn/begin"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challenge.challenge_id }),
      });
      const begin = await beginRes.json().catch(() => ({}));
      if (!beginRes.ok) throw new Error(begin.error || "Security key challenge failed");
      const credential = await window.ElvishWebAuthn.getAssertion(begin.options);
      const finishRes = await fetch(elvishApiUrl("/api/auth/2fa/login/webauthn/finish"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: begin.challenge_id, credential }),
      });
      const finish = await finishRes.json().catch(() => ({}));
      if (!finishRes.ok) throw new Error(finish.error || "Security key verification failed");
      await finalizeLogin(finish, username.trim().toLowerCase(), password);
    } catch (err) {
      setPhase("mfa");
      setMsg((err && err.message) || "Security key verification failed");
    }
  }

  return (
    <div className="auth-page">
      <window.ElvishPublicTopbar
        loginHref="/login"
        registerHref={nextOk ? `/register?next=${encodeURIComponent(nextOk)}` : "/register"}
      />

      <div className="auth-card">
        <div className="auth-card-h">
          <span className="kind">AUTH</span>
          <span className="dim">session · valkey</span>
        </div>
        <div className="auth-card-body">
          <h1>Log in</h1>
          <p className="lead">Sign in with your username and password for <strong>@{mailDomain || "…"}</strong>. Authentication uses <strong>SRP</strong>, so your password never goes over the wire, and the session cookie remains HTTP-only.</p>
          {phase !== "mfa" && phase !== "mfa_loading" && (
            <form onSubmit={submitPrimaryLogin}>
              <div className="auth-field">
                <label htmlFor="username">Username</label>
                <input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={phase === "loading"} />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={phase === "loading"} />
              </div>
              <div className="auth-field auth-inline-check-row">
                <label className="auth-inline-check">
                  <input
                    type="checkbox"
                    checked={rememberTrustedDevice}
                    onChange={(e) => setRememberTrustedDevice(e.target.checked)}
                    disabled={phase === "loading"}
                  />
                  <span>
                    <strong>Trusted device</strong>
                    {" "}— keep mailbox crypto keys in memory longer on this browser (about 14 days of inactivity, matching your session). Still cleared when you log out.
                  </span>
                </label>
              </div>
              {CapField && capWidgetURL ? (
                <div className="auth-field">
                  <label>Human verification</label>
                  <CapField widgetApiEndpoint={capWidgetURL} onTokenChange={setCapToken} />
                </div>
              ) : null}
              <div className={"auth-status " + (msg && phase !== "ok" ? "err" : phase === "ok" ? "ok" : "")}>{msg}</div>
              <div className="auth-actions">
                <button type="submit" className="btn-sm primary" disabled={phase === "loading"}>{phase === "loading" ? "…" : "▸ LOGIN"}</button>
                <a className="btn-sm" href={nextOk ? `/register?next=${encodeURIComponent(nextOk)}` : "/register"}>Create account</a>
              </div>
            </form>
          )}
          {(phase === "mfa" || phase === "mfa_loading") && (
            <form onSubmit={submitCode}>
              <p className="lead">
                Confirm your sign-in for <strong>{challenge && challenge.user && challenge.user.email ? challenge.user.email : (username ? `${username}@${mailDomain || "…"}` : "your account")}</strong>.
              </p>
              {challenge && Array.isArray(challenge.methods) && challenge.methods.length > 1 && (
                <div className="auth-actions" style={{ marginBottom: 12 }}>
                  {challenge.methods.includes("totp") && (
                    <button type="button" className={"btn-sm " + (mfaMethod === "totp" ? "primary" : "")} onClick={() => setMfaMethod("totp")} disabled={phase === "mfa_loading"}>
                      Authenticator app
                    </button>
                  )}
                  {challenge.methods.includes("recovery") && (
                    <button type="button" className={"btn-sm " + (mfaMethod === "recovery" ? "primary" : "")} onClick={() => setMfaMethod("recovery")} disabled={phase === "mfa_loading"}>
                      Recovery code
                    </button>
                  )}
                  {challenge.methods.includes("webauthn") && (
                    <button type="button" className="btn-sm" onClick={useSecurityKey} disabled={phase === "mfa_loading"}>
                      Use security key
                    </button>
                  )}
                </div>
              )}
              {(mfaMethod === "totp" || mfaMethod === "recovery") && (
                <div className="auth-field">
                  <label htmlFor="mfa-code">{mfaMethod === "recovery" ? "Recovery code" : "Authenticator code"}</label>
                  <input
                    id="mfa-code"
                    type="text"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    disabled={phase === "mfa_loading"}
                    placeholder={mfaMethod === "recovery" ? "XXXX-XXXX-XXXX" : "123456"}
                  />
                </div>
              )}
              {challenge && challenge.methods && challenge.methods.includes("webauthn") && challenge.methods.length === 1 && (
                <div className="auth-actions" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn-sm primary" onClick={useSecurityKey} disabled={phase === "mfa_loading"}>
                    Use security key
                  </button>
                </div>
              )}
              <div className={"auth-status " + (msg ? "err" : "")}>{msg}</div>
              <div className="auth-actions">
                {(mfaMethod === "totp" || mfaMethod === "recovery") && (
                  <button type="submit" className="btn-sm primary" disabled={phase === "mfa_loading"}>
                    {phase === "mfa_loading" ? "…" : "▸ VERIFY"}
                  </button>
                )}
                <button type="button" className="btn-sm" onClick={() => { setPhase("idle"); setChallenge(null); setMsg(""); }} disabled={phase === "mfa_loading"}>
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) ReactDOM.createRoot(root).render(<LoginPage />);
