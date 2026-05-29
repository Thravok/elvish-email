// ELVISH — shared topbar / footer / chrome
function Topbar({ active }) {
  let activeNavId = null;
  let centerAfterNav = null;
  if (active === "home" || active === "tools") {
    activeNavId = "home";
  } else if (active === "mail") {
    activeNavId = "mail";
  } else if (active === "manifesto") {
    activeNavId = "manifesto";
  } else if (active === "admin") {
    centerAfterNav = <a href={elvishAdminHref("/")} className="navlink active" aria-current="page">PANEL</a>;
  } else if (active === "log") {
    centerAfterNav = <a href="/log/" className="navlink active" aria-current="page">LOG</a>;
  } else if (active === "modals") {
    centerAfterNav = <span className="navlink active" aria-current="page">MODALS</span>;
  }

  return (
    <window.ElvishPublicTopbar
      activeNavId={activeNavId}
      centerAfterNav={centerAfterNav}
      showMailLink={false}
      authContent={({ me, loggedIn, label }) => {
        if (me === null) return <span className="dim" style={{ fontSize: 10 }}>…</span>;
        if (!loggedIn) {
          return (
            <>
              <a href="/login" className="navlink">LOGIN</a>
              <a href="/register" className="navlink">REGISTER</a>
            </>
          );
        }
        return (
          <>
            <span className="nav-session dim" title={me.email || ""}>{label}</span>
            {me.is_admin && active !== "admin" && <a href={elvishAdminHref("/")} className="navlink">PANEL</a>}
            <form className="nav-inline-form" action="/auth/logout" method="post">
              <input type="hidden" name="next" value={window.location.pathname} />
              <button type="submit" className="navlink">LOGOUT</button>
            </form>
          </>
        );
      }}
    />
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>
        <div className="ftk">// IDENT</div>
        <div className="brand" style={{ fontSize: 18, marginBottom: 8 }}><span className="dot"></span>ELVISH</div>
        <div className="dim">An anonymous workshop.<br/>Tools rendered free.<br/>No login. No price. No pitch.</div>
      </div>
      <div>
        <div className="ftk">// PAGES</div>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/mail">Mail</a></li>
          <li><a href="/manifesto/">Security</a></li>
          <li><a href="/login">Log in</a></li>
          <li><a href="/register">Register</a></li>
          <li><a href={elvishAdminHref("/")}>Panel</a></li>
          <li><a href="#">Source</a></li>
        </ul>
      </div>
      <div>
        <div className="ftk">// PROTOCOL</div>
        <ul className="dim">
          <li>License — AGPL-3.0</li>
          <li>Hash — e2ee01f4</li>
          <li>Build — nightly · 26.05.10</li>
          <li>Encryption — OpenPGP</li>
        </ul>
      </div>
      <div>
        <div className="ftk">// SIGN</div>
        <div className="ascii">{`┌────────────────┐
│   ████  ████   │
│   ██ █  █ ██   │
│   ████  ████   │
│        ██      │
│   ████████     │
│   ██   ██      │
│   ████████     │
└────────────────┘`}</div>
        <div className="dim" style={{ marginTop: 10, fontSize: 10 }}>// END OF FILE</div>
      </div>
    </footer>
  );
}

window.Topbar = Topbar;
window.Footer = Footer;
