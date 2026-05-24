// ELVISH admin — grouped site/content editors for mail embed
const A = window.adm;
const { useState: useS_hub } = React;

const CONTENT_TABS = [
  { id: "nav", label: "Nav & footer", key: "SecNav" },
  { id: "hero", label: "Hero", key: "SecHero" },
  { id: "terminal", label: "Terminal", key: "SecTerminal" },
  { id: "log", label: "Log page", key: "SecLogPage" },
  { id: "ticker", label: "Ticker", key: "SecTicker" },
  { id: "tools", label: "Tools", key: "SecTools" },
  { id: "blog", label: "Blog", key: "SecPosts" },
  { id: "signing", label: "OpenPGP", key: "SecSigningPGP" },
];

function SecContentHub({ state, set, dirty, onPublish }) {
  const [tab, setTab] = useS_hub("nav");
  const def = CONTENT_TABS.find((t) => t.id === tab) || CONTENT_TABS[0];
  const Comp = window[def.key];
  const sectionProps = { state, set, dirty, onPublish };

  return (
    <>
      <A.H num="10" title="CONTENT" sub="site chrome · tools · blog · signing" />
      <div className="adm-explain" style={{ marginBottom: 12 }}>
        Public site presentation blocks. Changes save with the main site bundle (<code>PUT /api/admin/site/home</code>); blog posts use the posts API when published from the Blog tab.
      </div>
      <div className="filters" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {CONTENT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"btn-sm" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {typeof Comp === "function" ? (
        <Comp {...sectionProps} />
      ) : (
        <div className="f-err">Missing editor component <code>{def.key}</code>.</div>
      )}
    </>
  );
}

window.SecContentHub = SecContentHub;
