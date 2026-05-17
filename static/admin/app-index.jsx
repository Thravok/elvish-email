// ELVISH — index app
const { useState: useS, useEffect: useE } = React;

function App() {
  const T = window.useTweaks({
    "theme": "dark",
    "font": "ibm",
    "crosshair": false,
    "scanlines": true,
    "showGrid": true
  });
  const [tweak, setTweak] = T;

  const [konami, setKonami] = useS(false);

  // theme + font apply
  useE(() => {
    document.documentElement.setAttribute("data-theme", tweak.theme);
    document.documentElement.setAttribute("data-font", tweak.font);
    document.body.classList.toggle("crosshair-on", !!tweak.crosshair);
  }, [tweak.theme, tweak.font, tweak.crosshair]);

  // Konami
  useE(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let pos = 0;
    const onKey = (e) => {
      const k = e.key;
      if (k === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          document.body.classList.add("konami");
          setKonami(true);
          setTimeout(() => document.body.classList.remove("konami"), 1200);
          setTimeout(() => setKonami(false), 4000);
        }
      } else { pos = (k === seq[0]) ? 1 : 0; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // crosshair tracking
  useE(() => {
    if (!tweak.crosshair) return;
    const el = document.querySelector(".crosshair");
    if (!el) return;
    const onMove = (e) => { el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [tweak.crosshair]);

  return (
    <>
      {tweak.showGrid && <div className="bg-grid"></div>}
      {tweak.scanlines && <div className="scanline"></div>}
      <div className="crosshair"></div>

      <div className="frame">
        <window.Topbar active="home" />
        <div style={{ marginTop: 8, marginBottom: 4, fontSize: 10, letterSpacing: "0.18em", color: "var(--dim)", textTransform: "uppercase", textAlign: "right" }}>
          <a href="/login" style={{ color: "var(--accent)" }}>log in</a>
          <span className="dim"> · </span>
          <a href="/register" style={{ color: "var(--accent)" }}>register</a>
          <span className="dim"> · </span>
          <a href="/admin/" style={{ color: "var(--accent)" }}>panel</a>
        </div>

        <Terminal />

        <section className="hero">
          <div className="hero-l">
            <div className="section-label"><span className="index">§ 00</span> E2EE MAIL <span className="rule"></span></div>
            <h1 className="display" style={{ marginTop: 18 }}>
              <span className="stripe">END-TO-END</span> ENCRYPTED<br/>
              MAIL.<br/>
              <span className="stripe">ZERO-ACCESS</span> DELIVERY.
            </h1>
            <p className="lede">
              <strong>ELVISH</strong> is an end-to-end encrypted mail platform. Messages are encrypted in your browser before storage or delivery. Use OpenPGP inboxes, protected links, or relay mode without giving the server your plaintext. <span className="dim">// zero-access by design</span>
            </p>
            <div className="hero-meta">
              <div><div className="k">ENCRYPTION</div><div className="v">OPENPGP</div></div>
              <div><div className="k">KEYS</div><div className="v">BROWSER-HELD</div></div>
              <div><div className="k">DELIVERY</div><div className="v">SMTP + LINK</div></div>
              <div><div className="k">STORAGE</div><div className="v">CIPHERTEXT</div></div>
            </div>
          </div>
          <div className="hero-r">
            <div className="panel">
              <h4>// MAIL FLOW</h4>
              <div className="home-flow">
                <div className="home-flow-step">
                  <div className="home-flow-index">01</div>
                  <div className="home-flow-copy">
                    <strong>Compose and encrypt in the browser</strong>
                    <span className="dim">Keys unlock locally, then message bodies are encrypted before they ever hit storage.</span>
                  </div>
                </div>
                <div className="home-flow-step">
                  <div className="home-flow-index">02</div>
                  <div className="home-flow-copy">
                    <strong>Store ciphertext, not plaintext</strong>
                    <span className="dim">The operator sees encrypted blobs, wrapped key material, and delivery metadata only.</span>
                  </div>
                </div>
                <div className="home-flow-step">
                  <div className="home-flow-index">03</div>
                  <div className="home-flow-copy">
                    <strong>Decrypt where the recipient opens</strong>
                    <span className="dim">OpenPGP recipients decrypt with their keys; protected links unlock client-side with a shared secret.</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="panel">
              <h4>// THREAT MODEL</h4>
              <div className="row home-kv"><span className="dim">SERVER</span><span>CIPHERTEXT ONLY</span></div>
              <div className="row home-kv"><span className="dim">PRIVATE KEYS</span><span>LOCAL ONLY</span></div>
              <div className="row home-kv"><span className="dim">SEARCH</span><span>LOCAL BODY INDEX</span></div>
              <div className="row home-kv"><span className="dim">PORTABILITY</span><span>OPENPGP EXPORT</span></div>
            </div>
            <div className="panel">
              <h4>// SEND MODES</h4>
              <div className="row home-kv"><span className="dim">MODE A</span><span>PGP DIRECT</span></div>
              <div className="row home-kv"><span className="dim">MODE B</span><span>PROTECTED LINK</span></div>
              <div className="row home-kv"><span className="dim">MODE C</span><span>PLAINTEXT RELAY</span></div>
              <div className="row home-kv"><span className="dim">DELIVERY</span><span>SMTP + CUSTOM DOMAINS</span></div>
            </div>
          </div>
        </section>

        <div className="section-label home-section-label">
          <span className="index">// 01</span> DELIVERY <span className="rule"></span>
          <span className="tiny dim">THREE WAYS TO SEND SECURELY</span>
        </div>
        <div className="home-card-grid">
          <article className="home-card">
            <h4>// OPENPGP DIRECT</h4>
            <p>Encrypt directly to a recipient&apos;s published key and keep the message protected across the full route.</p>
            <div className="tiny dim">BEST FOR · PGP USERS · STANDARD MAIL CLIENTS</div>
          </article>
          <article className="home-card">
            <h4>// PROTECTED LINKS</h4>
            <p>Wrap the body under a sender-chosen password and deliver an unlock link. The password never reaches the server.</p>
            <div className="tiny dim">BEST FOR · ANY RECIPIENT · CLIENT-SIDE UNLOCK</div>
          </article>
          <article className="home-card">
            <h4>// RELAY MODE</h4>
            <p>When plaintext delivery is unavoidable, persist only relay-key-wrapped ciphertext and decrypt only in memory at send time.</p>
            <div className="tiny dim">BEST FOR · LEGACY SMTP · MINIMIZED PLAINTEXT EXPOSURE</div>
          </article>
        </div>

        <div className="section-label home-section-label">
          <span className="index">// 02</span> SECURITY <span className="rule"></span>
          <span className="tiny dim">MAIL-FIRST ZERO-ACCESS ARCHITECTURE</span>
        </div>
        <div className="home-card-grid home-card-grid--four">
          <article className="home-card">
            <h4>// KEYS STAY CLIENT-SIDE</h4>
            <p>Account and identity keys are generated or unlocked in the browser so operators cannot silently read inbox contents.</p>
          </article>
          <article className="home-card">
            <h4>// CIPHERTEXT AT REST</h4>
            <p>Mailbox bodies and protected-link payloads are stored as encrypted objects, not plaintext rows waiting to leak.</p>
          </article>
          <article className="home-card">
            <h4>// LOCAL-ONLY SEARCH</h4>
            <p>Body indexing stays on the device, preserving searchability without handing message contents to the backend.</p>
          </article>
          <article className="home-card">
            <h4>// OPEN STANDARDS</h4>
            <p>OpenPGP import/export, SMTP delivery, and publishable public keys keep the system interoperable instead of walled off.</p>
          </article>
        </div>

        <div className="section-label home-section-label">
          <span className="index">// 03</span> PROTOCOL <span className="rule"></span>
          <span className="tiny dim">TRUST SIGNALS</span>
        </div>
        <div className="home-protocol-grid">
          <div className="home-stats-grid">
            <div className="home-stat">
              <div className="home-stat-key">ENCRYPTION</div>
              <div className="home-stat-value">OPENPGP</div>
            </div>
            <div className="home-stat">
              <div className="home-stat-key">KEYS</div>
              <div className="home-stat-value">BROWSER-HELD</div>
            </div>
            <div className="home-stat">
              <div className="home-stat-key">DELIVERY</div>
              <div className="home-stat-value">SMTP + LINK</div>
            </div>
            <div className="home-stat">
              <div className="home-stat-key">STORAGE</div>
              <div className="home-stat-value">CIPHERTEXT</div>
            </div>
          </div>
          <aside className="home-callout bracket" aria-label="Why ELVISH mail exists">
            <span className="br-bl"></span><span className="br-br"></span>
            <div className="ftk">// WHY ELVISH</div>
            <p>Plain email asks you to trust every provider in the path with message content. ELVISH moves encryption decisions to the browser so storage, queues, and relays handle protected payloads instead of readable mail.</p>
          </aside>
        </div>

        <div className="stripe-band"></div>

        <div className="ticker" style={{ marginTop: 16 }}>
          <div className="ticker-track">
            <span>E2EE BY DEFAULT</span><span>BROWSER-HELD KEYS</span><span>ZERO-ACCESS STORAGE</span><span>OPENPGP COMPATIBLE</span>
            <span>PROTECTED LINKS</span><span>PLAINTEXT RELAY</span><span>OPEN SOURCE</span><span>AGPL-3.0</span><span>ELVISH MAIL</span>
            <span>E2EE BY DEFAULT</span><span>BROWSER-HELD KEYS</span><span>ZERO-ACCESS STORAGE</span><span>OPENPGP COMPATIBLE</span>
            <span>PROTECTED LINKS</span><span>PLAINTEXT RELAY</span><span>OPEN SOURCE</span><span>AGPL-3.0</span><span>ELVISH MAIL</span>
          </div>
        </div>

        <Footer />

        {konami && <div className="konami-toast">DEV MODE ENGAGED · WELCOME, FRIEND</div>}

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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
