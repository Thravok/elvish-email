// ELVISH — /register
const { useState, useEffect } = React;

function safeClientRedirectPath(next) {
  if (typeof next !== "string") return "";
  next = next.trim();
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
  return next;
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

function RegisterPage() {
  const [username, setUsername] = useState("");
  const [mailDomain, setMailDomain] = useState("");
  const [domainLoading, setDomainLoading] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [loadingStep, setLoadingStep] = useState("idle");
  const [msg, setMsg] = useState("");
  const [nextOk, setNextOk] = useState("");
  const [capWidgetURL, setCapWidgetURL] = useState("");
  const [capToken, setCapToken] = useState("");
  const [uiTheme, setUiTheme] = useState("auto");

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
    fetch("/api/auth/signup-config")
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
      })
      .finally(() => setDomainLoading(false));
  }, []);

  const normalizedUsername = username.trim().toLowerCase();
  const composedEmail =
    mailDomain && normalizedUsername
      ? `${normalizedUsername}@${mailDomain}`
      : mailDomain
        ? `username@${mailDomain}`
        : "";
  const passwordRemaining = Math.max(0, 10 - password.length);
  const passwordReady = password.length >= 10;
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const capOk = !capWidgetURL || (capToken && capToken.trim());
  const canSubmit =
    phase !== "loading" &&
    !!normalizedUsername &&
    !!mailDomain &&
    passwordReady &&
    password === confirmPassword &&
    capOk;
  const registerSteps = [
    {
      id: "keygen",
      label: "Generate encryption keys locally",
      help: "Your browser creates the account and identity keys before anything is sent.",
    },
    {
      id: "submit",
      label: "Create the account and SRP verifier",
      help: "The server stores wrapped key material and verifier data, not your password.",
    },
    {
      id: "redirect",
      label: "Open your mailbox",
      help: "New accounts go straight to mail so first-run setup stays in one flow.",
    },
  ];

  function stepState(stepId) {
    if (phase !== "loading" && phase !== "ok") return "pending";
    if (phase === "ok") return "complete";
    const order = ["keygen", "submit", "redirect"];
    const current = order.indexOf(loadingStep);
    const target = order.indexOf(stepId);
    if (current === -1 || target === -1) return "pending";
    if (target < current) return "complete";
    if (target === current) return "active";
    return "pending";
  }

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoadingStep("idle");
    const u = normalizedUsername;
    if (!u) {
      setMsg("Username is required.");
      return;
    }
    if (!mailDomain) {
      setMsg("Could not load mail domain — refresh and try again.");
      return;
    }
    if (password.length < 10) {
      setMsg("Password must be at least 10 characters.");
      return;
    }
    if (!confirmPassword) {
      setMsg("Confirm your password to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }
    if (capWidgetURL && !capToken.trim()) {
      setMsg("Complete the human verification challenge first.");
      return;
    }
    if (typeof window.ElvishKeygen === "undefined") {
      setMsg("Crypto subsystem not loaded — refresh and try again.");
      return;
    }
    const email = `${u}@${mailDomain}`;
    setPhase("loading");
    setLoadingStep("keygen");
    setMsg("Generating strong encryption keys in your browser. This can take a few seconds.");
    let keys;
    let srp;
    const bootstrapStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    try {
      keys = await window.ElvishKeygen.bootstrap(email, password);
      if (!window.ElvishSRP) throw new Error("SRP subsystem not loaded");
      srp = await window.ElvishSRP.createRegistration(u, password);
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "register_bootstrap", bootstrapStartedAt, "success");
    } catch (err) {
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "register_bootstrap", bootstrapStartedAt, "failure");
      setPhase("idle");
      setLoadingStep("idle");
      setMsg("Key generation failed: " + (err && err.message ? err.message : String(err)));
      return;
    }
    const submitStartedAt = window.ElvishPerf && window.ElvishPerf.start ? window.ElvishPerf.start() : 0;
    try {
      setLoadingStep("submit");
      setMsg("Creating your account and starting your secure mailbox…");
      const identityWrappedB64 = window.ElvishKeygen.bytesToB64(
        new TextEncoder().encode(keys.identity.wrapped_secret_armored)
      );
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: u,
          name: name.trim(),
          company: "",
          cap_token: capWidgetURL ? capToken.trim() : "",
          ui_theme: uiTheme,
          srp_salt_b64: srp.srp_salt_b64,
          srp_verifier_b64: srp.srp_verifier_b64,
          srp_group: srp.srp_group,
          srp_hash: srp.srp_hash,
          account_key: {
            armored_public: keys.account.armored_public,
            algorithm: "openpgp-ecc-curve25519",
            key_version: 1,
            wrapped_secret_b64: keys.account.wrapped_secret_b64,
            kdf: keys.account.kdf,
            kdf_salt_b64: keys.account.kdf_salt_b64,
            kdf_params_json: JSON.stringify(keys.account.kdf_params || {}),
            identities: [{
              email: keys.identity.email,
              armored_public: keys.identity.armored_public,
              primary_uid: keys.identity.email,
              wrapped_secret_b64: identityWrappedB64,
              is_default: true,
            }],
          },
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "register_submit", submitStartedAt, "failure");
        setPhase("idle");
        setLoadingStep("idle");
        setMsg(j.error || "Registration failed.");
        return;
      }
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "register_submit", submitStartedAt, "success");
      if (j.user) applyClientThemeFromUser(j.user);
      setPhase("ok");
      setLoadingStep("redirect");
      setMsg("Account created. Opening mail…");
      const fallback = "/mail";
      const dest = nextOk || fallback;
      window.location.href = dest;
    } catch (err) {
      if (window.ElvishPerf) window.ElvishPerf.end("auth_ui", "register_submit", submitStartedAt, "failure");
      setPhase("idle");
      setLoadingStep("idle");
      setMsg("Network error — is elvishserver running?");
    }
  };

  return (
    <div className="auth-page">
      <window.ElvishPublicTopbar
        loginHref={nextOk ? `/login?next=${encodeURIComponent(nextOk)}` : "/login"}
        registerHref="/register"
      />

      <div className="auth-card auth-card-register">
        <div className="auth-card-h">
          <span className="kind">AUTH</span>
          <span className="dim">bcrypt · valkey · e2ee keys</span>
        </div>
        <div className="auth-card-body">
          <h1>Create your address</h1>
          <p className="lead">Choose a username and password for <strong>@{mailDomain || "…"}</strong>. ELVISH generates your account keys in the browser and stores only wrapped key material plus SRP verifier data on the server.</p>
          <div className="auth-preview-card">
            <div className="auth-preview-label">Address preview</div>
            <div className="auth-preview-value mono">{composedEmail || "Loading mail domain…"}</div>
            <div className="auth-preview-help">
              {domainLoading
                ? "Loading the signup domain for this server…"
                : "Your final address uses a lowercased username so it stays predictable everywhere."}
            </div>
          </div>
          <div className="auth-step-list" aria-label="Registration progress">
            {registerSteps.map((step, index) => {
              const state = stepState(step.id);
              return (
                <div key={step.id} className={"auth-step " + state}>
                  <span className="auth-step-marker" aria-hidden="true">
                    {state === "complete" ? "✓" : state === "active" ? "…" : index + 1}
                  </span>
                  <div className="auth-step-copy">
                    <strong>{step.label}</strong>
                    <span>{step.help}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="auth-field">
            <label>Appearance</label>
            <div className="auth-appearance-seg" role="group" aria-label="Color scheme">
              {[
                ["auto", "Auto"],
                ["dark", "Dark"],
                ["light", "Light"],
              ].map(([val, lab]) => (
                <button
                  key={val}
                  type="button"
                  className={"auth-appearance-btn" + (uiTheme === val ? " auth-appearance-btn--on" : "")}
                  aria-pressed={uiTheme === val}
                  disabled={phase === "loading"}
                  onClick={() => setUiTheme(val)}
                >
                  {lab}
                </button>
              ))}
            </div>
            <div className="auth-field-hint">Auto follows your system light or dark mode.</div>
          </div>
          <form onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={phase === "loading"}
                placeholder="sable"
                spellCheck={false}
              />
              <div className="auth-field-hint">
                {mailDomain ? `Creates ${normalizedUsername || "username"}@${mailDomain}` : "Loading the mail domain…"}
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="name">Display name <span className="auth-label-optional">optional</span></label>
              <input
                id="name"
                type="text"
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                disabled={phase === "loading"}
              />
              <div className="auth-field-hint">Shown as your sender name when you send mail.</div>
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-row">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={phase === "loading"}
                  placeholder="At least 10 characters"
                />
                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={phase === "loading"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className={"auth-field-hint " + (passwordReady ? "ok" : password.length ? "warn" : "")}>
                {password.length === 0
                  ? "Use at least 10 characters. This password unlocks your account key on this device."
                  : passwordReady
                    ? "Looks good. Your password never leaves the browser."
                    : `${passwordRemaining} more character${passwordRemaining === 1 ? "" : "s"} to reach the minimum.`}
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={phase === "loading"}
                placeholder="Re-enter your password"
              />
              <div className={"auth-field-hint " + (confirmPassword.length === 0 ? "" : passwordsMatch ? "ok" : "warn")}>
                {confirmPassword.length === 0
                  ? "Re-enter it once so you do not accidentally lock yourself out."
                  : passwordsMatch
                    ? "Passwords match."
                    : "Passwords do not match yet."}
              </div>
            </div>
            {CapField && capWidgetURL ? (
              <div className="auth-field">
                <label>Human verification</label>
                <CapField widgetApiEndpoint={capWidgetURL} onTokenChange={setCapToken} />
              </div>
            ) : null}
            <div
              className={"auth-status " + (phase === "loading" ? "info" : msg && phase !== "ok" ? "err" : phase === "ok" ? "ok" : "")}
              role="status"
              aria-live="polite"
            >
              {msg}
            </div>
            <div className="auth-actions">
              <button type="submit" className="btn-sm primary" disabled={!canSubmit}>
                {phase === "loading" ? <span className="auth-btn-spinner" aria-hidden="true"></span> : null}
                {phase === "loading"
                  ? loadingStep === "keygen"
                    ? "Generating keys…"
                    : loadingStep === "submit"
                      ? "Creating account…"
                      : "Opening mail…"
                  : "▸ CREATE ACCOUNT"}
              </button>
              <a className="btn-sm" href={nextOk ? `/login?next=${encodeURIComponent(nextOk)}` : "/login"}>Already have an account</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) ReactDOM.createRoot(root).render(<RegisterPage />);
