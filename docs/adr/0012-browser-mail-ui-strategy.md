# ADR 0012 — Browser mail UI delivery strategy

## Status

Accepted (2026-05)

## Context

ELVish serves mail, auth, and admin as HTML shells with substantial client-side crypto (OpenPGP.js, WebCrypto, SRP/WebAuthn helpers). Historically the shells loaded in-browser Babel and development React builds, which increased CPU, payload size, and forced a permissive Content Security Policy (`unsafe-eval`).

The product needs a clear split between:

1. **Server-owned surfaces** — routing, security headers, feature flags, and static asset hashing.
2. **Browser-owned crypto and UI** — key unwrap, decrypt/sign, MIME handling, and interactive mail chrome.

Alternatives considered:

- **Compiled React SPA (single or few hashed bundles)** — esbuild produces IIFE bundles from `frontend/entries/*` into `static/dist/`; HTML loads vendor OpenPGP and one app script. Crypto stays in JavaScript/TypeScript with minimal server coupling.
- **Go-rendered shell (templ or `html/template`) + thin TypeScript crypto bundle** — Go emits HTML and script tags; a small esbuild bundle exposes only crypto and API glue. Full mail UI would still need a non-trivial client layer unless rewritten to HTMX-style forms (high cost for mail triage, compose, and settings).
- **Go or Rust WASM crypto in the browser** — largest engineering cost; only justified if OpenPGP.js must be dropped for binary size or supply-chain reasons.

## Decision

**Ship the compiled React 19 + esbuild pipeline as the primary strategy** (`frontend/build.mjs`, `static/dist/*`, `make static-js` / `make build`). Self-hosted scripts and vendored OpenPGp 6 stay under `static/` with no third-party script origins on secure shells (see `internal/httpserver/secure_surfaces_test.go`).

**Defer a Go-first templ shell** to a later phase unless product requirements change (e.g. mandatory server-driven navigation for every view). If adopted later, the incremental path is: Go templates for layout and asset URLs only, while **keeping one hashed JS bundle** for mail and crypto rather than re-implementing the mail UI in server templates.

## Consequences

- **Positive:** Production-sized React, no runtime Babel, CSP can omit `unsafe-eval` for script execution (see `internal/httpserver/secure_page_headers.go`). One documented build step (`make static-js`) keeps mail, auth, and admin bundles aligned.
- **Negative:** Contributors need Node.js for bundle regeneration; JSX or dependency changes require `make static-js` (or `make build`) before shipping updated `static/dist/` artifacts in commits, if the repo tracks built output.
- **Monitoring:** Revisit this ADR if bundle size, CSP `unsafe-inline` for scripts, or WASM crypto becomes a hard requirement.

## Supply chain and dependency surface (2026-05 iteration)

Goals: **fewer bytes executed by default**, **smaller first-load parse surface**, and a path toward **less framework in the chrome** without pretending the browser can drop OpenPGP.js while keeping E2EE mail.

**Implemented:**

- **Lazy embedded admin:** [`static/mail/mail-app.jsx`](static/mail/mail-app.jsx) loads [`static/dist/mail-admin-embed.js`](static/dist/mail-admin-embed.js) only when an operator switches to the Admin view from `/mail`. The main [`static/dist/mail-bundle.js`](static/dist/mail-bundle.js) omits admin section modules. The embed build **aliases `react` and `react-dom/client`** to shims that read `globalThis.React` / `globalThis.ReactDOM` from the mail bundle so **React is not duplicated** in that second file (see [`frontend/shims/`](frontend/shims/) and [`frontend/entries/mail-admin-embed-entry.jsx`](frontend/entries/mail-admin-embed-entry.jsx)).

**Planned / larger follow-ups:**

- **Thin TypeScript crypto + API layer** (no React): move mail `fetch` helpers and MIME-adjacent pure logic into a small esbuild entry (or `static/mail/lib/` compiled TS) so the mail chrome can shrink toward vanilla or templ-driven DOM.
- **Go `templ` or `html/template` shells** for layout and hashed asset URLs; keep explicit script entrypoints (no third-party script CDNs).
- **Optional framework removal** on mail chrome only after triage/compose/settings have a replacement story (keyboard UX, a11y, large settings surface).

The operator panel is **mail-embedded only** (`/mail?view=admin` + [`mail-admin-embed.js`](static/dist/mail-admin-embed.js)). Legacy `/admin/` URLs redirect to mail.

## Recorded scope: moving off React (phased)

This records **explicit choices** for future work (see also [CONTRIBUTING.md](CONTRIBUTING.md) — browser UI security checklist). Revisit in ADR if product priorities change.

**Target stack (default):** **Go `templ` or `html/template` for HTML shells** (layout, nav, hashed script tags) plus **vanilla DOM** for interactive chrome where feasible, and **esbuild-bundled TypeScript** for crypto and API glue (OpenPGP, WebCrypto, SRP helpers) **without** adding another UI framework (no Lit/Svelte layer unless this ADR is amended—goal is fewer npm dependencies, not a parallel component runtime).

**Order of replacement (first → last):**

1. **Auth surfaces** — [`static/auth/login.html`](static/auth/login.html), [`static/auth/register.html`](static/auth/register.html), and their [`frontend/entries/auth-*-entry.jsx`](frontend/entries/) bundles: smaller than mail triage; good place to prove **templ shell + thin TS crypto** and stricter CSP story.
2. **Shared thin TS layer** — mail manifest / fetch wrappers / pure MIME helpers compiled as a small non-React bundle consumed by remaining React or vanilla callers.
3. **Operator panel** — further slimming of [`mail-admin-embed.js`](static/dist/mail-admin-embed.js) after auth pattern is stable.
4. **Mail chrome last** — list, detail, compose, [`static/mail/mail-settings.jsx`](static/mail/mail-settings.jsx): largest UX and a11y footprint; migrate only after (1)–(3) de-risk templ + TS split.

**Already done toward (3)/(4) without a framework swap:** lazy [`mail-admin-embed.js`](frontend/entries/mail-admin-embed-entry.jsx) so default mail load excludes admin modules.
