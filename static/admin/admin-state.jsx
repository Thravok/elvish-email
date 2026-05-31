// ELVISH admin — initial mock state (the panel's source of truth, in-memory)
const ADMIN_STATE_INITIAL = {
  site: {
    title: "ELVISH — end-to-end encrypted mail",
    description: "End-to-end encrypted mail with browser-held keys, OpenPGP interoperability, and zero-access storage.",
    base_url: "https://elvish.example",
    blog_signing: { public_key_url: "/signing.pub" },
    version: "v0.8.0",
    build_label: "NIGHTLY",
    license_line: "AGPL-3.0",
    hash_short: "e2ee01f4",
    build_date: "26.05.10"
  },
  tweak_defaults: {
    theme: "dark",
    font: "ibm",
    crosshair: false,
    scanlines: true,
    show_grid: true
  },
  support: {
    default_email: "",
    contacts: []
  },
  nav: [
    { id: "home",      href: "/",            label: "HOME" },
    { id: "mail",      href: "/mail",        label: "MAIL" },
    { id: "manifesto", href: "/manifesto/",  label: "SECURITY" }
  ],
  footer: {
    tagline: "Encrypted email.\nYour keys, your messages.\nZero-access architecture.\n",
    pages: [
      { href: "/", label: "Home" },
      { href: "/mail", label: "Mail" },
      { href: "/manifesto/", label: "Security" },
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Register" },
      { href: "/admin/", label: "Panel" },
      { href: "#", label: "Source" }
    ],
    protocol: [
      "License — AGPL-3.0",
      "Hash — e2ee01f4",
      "Build — nightly · 26.05.10",
      "Encryption — OpenPGP"
    ],
    ascii_block: "┌────────────────┐\n│   ████  ████   │\n│   ██ █  █ ██   │\n│   ████  ████   │\n│        ██      │\n│   ████████     │\n│   ██   ██      │\n│   ████████     │\n└────────────────┘",
    ascii_scale_to_fit: false
  },
  hero: {
    section_index: "00",
    section_title: "E2EE MAIL",
    lines: [
      { parts: [{ stripe: true, text: "END-TO-END" }, { stripe: false, text: " ENCRYPTED" }] },
      { parts: [{ stripe: false, text: "MAIL." }] },
      { parts: [{ stripe: true, text: "ZERO-ACCESS" }, { stripe: false, text: " DELIVERY." }] }
    ],
    lede_markdown: "**ELVISH** is an end-to-end encrypted mail platform. Messages are encrypted in your browser before storage or delivery. Use OpenPGP inboxes, protected links, or relay mode without giving the server your plaintext. // zero-access by design",
    stats: [
      { key: "ENCRYPTION", value: "OPENPGP" },
      { key: "KEYS", value: "BROWSER-HELD" },
      { key: "DELIVERY", value: "SMTP + LINK" },
      { key: "STORAGE", value: "CIPHERTEXT" }
    ],
    load_bar_heights: [24,32,28,40,36,52,46,38,44,50,42,30,36,48,40],
    sys_rows: [
      { label: "SERVER", value: "CIPHERTEXT ONLY", status: "ok" },
      { label: "PRIVATE KEYS", value: "LOCAL ONLY", status: "ok" },
      { label: "SEARCH", value: "LOCAL BODY INDEX", status: "ok" },
      { label: "PORTABILITY", value: "OPENPGP EXPORT", status: "dim" }
    ],
    keyboard_rows: [
      { label: "FOCUS NEXT", key: "j" },
      { label: "FOCUS PREV", key: "k" },
      { label: "SEARCH",     key: "/" },
      { label: "OPEN",       key: "↵" }
    ],
    tools_section: { section_index: "01", section_title: "DELIVERY", hint: "PGP DIRECT · PROTECTED LINKS · PLAINTEXT RELAY" }
  },
  terminal: {
    lines: [
      { kind: "sys",    text: "elvish:~$ ./boot --mail" },
      { kind: "log",    text: "[ OK ] mounting local key vault" },
      { kind: "log",    text: "[ OK ] resolving mail + delivery modules" },
      { kind: "log",    text: "[ OK ] telemetry default: off. anonymous export only." },
      { kind: "log",    text: "[ OK ] storage mode: ciphertext at rest" },
      { kind: "log",    text: "[ OK ] handshake: ELVISH/0.8.0-nightly" },
      { kind: "blank",  text: "" },
      { kind: "head",   text: "// END-TO-END MAIL. BROWSER KEYS. CIPHERTEXT AT REST." },
      { kind: "head",   text: "// OPENPGP INBOXES. PROTECTED LINKS. PLAINTEXT RELAY." },
      { kind: "blank",  text: "" },
      { kind: "prompt", text: "elvish:~$ open /mail" }
    ]
  },
  tools: [
    { id: "01", slug: "shroud",   name: "SHROUD",   tag: "live", desc: "Strip metadata from any file in your browser. Nothing uploaded.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "shroud", calls: "—", since: "23.04", open_href: "", monitor: null },
    { id: "02", slug: "tessera",  name: "TESSERA",  tag: "live", desc: "Lossless image dicer. Slice, tile, atlas. Drag-drop, never leaves the tab.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "tessera", calls: "—", since: "23.07", open_href: "", monitor: null },
    { id: "03", slug: "cipher-0", name: "CIPHER-0", tag: "live", desc: "Symmetric & PGP toolbox. Keys live in IndexedDB only.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "cipher", calls: "—", since: "22.11", open_href: "", monitor: null },
    { id: "04", slug: "ledger",   name: "LEDGER",   tag: "beta", desc: "Plaintext-first ledger. Double-entry, encrypted, exports CSV/Beancount.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "ledger", calls: "—", since: "25.02", open_href: "", monitor: null },
    { id: "05", slug: "vector",   name: "VECTOR",   tag: "live", desc: "Tiny SVG editor for technical diagrams. Pen, grid, ortho-snap.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "vector", calls: "—", since: "24.01", open_href: "", monitor: null },
    { id: "06", slug: "loom",     name: "LOOM",     tag: "live", desc: "Markdown to print-ready PDF. Footnotes, kerning, drop caps, no fluff.", signals: ["BROWSER-ONLY", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "loom", calls: "—", since: "24.06", open_href: "", monitor: null },
    { id: "07", slug: "hex-9",    name: "HEX-9",    tag: "live", desc: "Hex/binary editor with templates. Inspect headers without leaving the page.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "hex", calls: "—", since: "24.09", open_href: "", monitor: null },
    { id: "08", slug: "sigil",    name: "SIGIL",    tag: "beta", desc: "Generative QR with logo embed and error correction tuning.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "sigil", calls: "—", since: "25.04", open_href: "", monitor: null },
    { id: "09", slug: "drift",    name: "DRIFT",    tag: "wip", desc: "Local-first feed reader. RSS, Atom, JSON-feed. Sync via your own bucket.", signals: ["LOCAL-FIRST", "OPTIONAL-SYNC", "OFFLINE-CAPABLE", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "drift", calls: "—", since: "26.02", open_href: "", monitor: null },
    { id: "10", slug: "obscura",  name: "OBSCURA",  tag: "live", desc: "Image redactor with reversible-proof crops. Pixel hashes printed beside.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "obscura", calls: "—", since: "23.12", open_href: "", monitor: null },
    { id: "11", slug: "monolith", name: "MONOLITH", tag: "beta", desc: "Bundle a whole webpage into a single offline-capable HTML file.", signals: ["BROWSER-ONLY", "OFFLINE-CAPABLE", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "monolith", calls: "—", since: "25.06", open_href: "", monitor: null },
    { id: "12", slug: "echo",     name: "ECHO",     tag: "wip", desc: "Voice memo transcriber. Whisper-tiny in browser, no upload.", signals: ["BROWSER-ONLY", "NO-UPLOAD", "OPEN-SOURCE", "NO-ACCOUNT"], glyph: "echo", calls: "—", since: "26.04", open_href: "", monitor: null }
  ],
  log_page: {
    section_index: "LOG",
    section_title: "CHRONOLOGY",
    headlines: [
      { parts: [{ stripe: false, text: "THE " }, { stripe: true, text: "LOG" }] },
      { parts: [{ stripe: false, text: "IS THE PRODUCT" }] },
      { parts: [{ stripe: false, text: "CHANGELOG." }] }
    ],
    intro_markdown: "Releases, audit notes, the occasional essay. Nothing scheduled. No newsletter. Bookmark or scrape; both are blessed.",
    tagline_accent: "// reverse-chronological. tail -f the world.",
    filters: [
      { id: "all",      label: "ALL" },
      { id: "release",  label: "RELEASE" },
      { id: "essay",    label: "ESSAY" },
      { id: "security", label: "SECURITY" },
      { id: "notes",    label: "NOTES" },
      { id: "infra",    label: "INFRA" }
    ],
    ticker: ["END OF LOG","NO COMMENTS","NO TRACKERS","NO PAYWALL","SUBSCRIBE VIA RSS OR DON'T","I'M NOT KEEPING SCORE"]
  },
  ticker_home: ["NO ACCOUNTS","TELEMETRY OFF BY DEFAULT","NO ADS","NO FOMO","OPEN SOURCE","OFFLINE-CAPABLE","EDGE-EXECUTED","PUBLIC DOMAIN INTENT","SIGNED BY ANON","BUILD — NIGHTLY","HASH — D4F3A2C1","ELVISH — V0.7.4"],
  posts: [
    { date: "26.05.03", time: "12:00", title: "Welcome to the log", slug: "welcome", type: "notes", tags: ["notes"], draft: false, body: "This is the default entry. Replace it with your own posts under `content/blog/` (or publish via the API when MongoDB is configured).", openpgp_sig: "", minisig: "" }
  ],
  metrics: {
    welcome: { bytes: "1KB", reach: "—" }
  }
};

window.ADMIN_STATE_INITIAL = ADMIN_STATE_INITIAL;

/** Deep-merge saved admin state with defaults so missing/corrupt keys cannot blank the panel. */
function mergeAdminStateWithDefaults(saved, defaults) {
  if (Array.isArray(defaults)) {
    return Array.isArray(saved) ? saved : defaults.slice();
  }
  if (defaults !== null && typeof defaults === "object") {
    var src = saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    var merged = {};
    for (var k in defaults) {
      if (!Object.prototype.hasOwnProperty.call(defaults, k)) continue;
      merged[k] = mergeAdminStateWithDefaults(src[k], defaults[k]);
    }
    for (var k2 in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k2)) continue;
      if (!Object.prototype.hasOwnProperty.call(merged, k2)) merged[k2] = src[k2];
    }
    return merged;
  }
  return saved !== undefined ? saved : defaults;
}
window.mergeAdminStateWithDefaults = mergeAdminStateWithDefaults;

window.GLYPHS = ["shroud","tessera","cipher","ledger","vector","loom","hex","sigil","drift","obscura","monolith","echo"];
window.TERMINAL_KINDS = ["sys","log","head","prompt","blank"];
window.TWEAK_FONT_OPTIONS = [
  { value: "ibm",       label: "IBM Plex Mono" },
  { value: "jetbrains", label: "JetBrains Mono" },
  { value: "space",     label: "Space Mono / Grotesk" },
  { value: "display",   label: "Plex + Anton display" }
];
