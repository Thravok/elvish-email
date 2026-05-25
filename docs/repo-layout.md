# Repository layout

Single-page map of the **ELVish** monorepo (Go module `elvish`). For architecture and data planes, see [architecture.md](architecture.md). For day-to-day commands, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Top-level tree

| Path | Role |
|------|------|
| [`cmd/`](../cmd/) | Go binaries (thin `main` packages) |
| [`internal/`](../internal/) | Application libraries (not importable outside this module) |
| [`static/`](../static/) | Browser assets served as files; JSX sources and committed bundles under `static/dist/` |
| [`frontend/`](../frontend/) | esbuild pipeline (`build.mjs`, `package.json`) — produces `static/dist/*.js` |
| [`templates/`](../templates/) | Go `html/template` SSR for marketing pages, manifesto, blog shell |
| [`content/`](../content/) | Default site JSON and Markdown blog posts (seed when SQL is empty) |
| [`IOS/`](../IOS/) | SwiftUI iOS mail client (Xcode) |
| [`flutter/elvish_mail/`](../flutter/elvish_mail/) | Flutter Android mail client |
| [`docker/`](../docker/), [`docker-compose.yml`](../docker-compose.yml) | Local and deploy service definitions |
| [`docs/`](../docs/) | Specs, ADRs, OpenAPI supplement, runbooks |
| [`e2e/`](../e2e/) | Playwright admin smoke tests |
| [`.gitlab-ci.yml`](../.gitlab-ci.yml) | Primary CI (merge gate) |
| [`.github/workflows/`](../.github/workflows/) | GitHub Actions (CodeQL, iOS, Android, image publish) |

**Not served / not tracked (local only):**

- **`/public/`** — ignored by git; legacy static export. The live site uses `static/` plus SSR templates, not `public/`.
- **`/data/`** — ignored; runtime secrets (DKIM PEM, MFA key, relay key) for local dev.

## `cmd/` binaries

| Command | Purpose |
|---------|---------|
| [`elvishapi`](../cmd/elvishapi/) | HTTP/API tier: `/api/`, SSR, SQL migrations |
| [`elvishmta`](../cmd/elvishmta/) | SMTP MX + submission ingest |
| [`elvishworker`](../cmd/elvishworker/) | Outbox delivery + background sweepers |
| [`elvishserver`](../cmd/elvishserver/) | Removed (stub points to split binaries) |
| [`elvishdb`](../cmd/elvishdb/) | Connectivity check for `COCKROACH_DSN`, `VALKEY_ADDR`, etc. (`make db-health`) |
| [`elvishsign`](../cmd/elvishsign/) | Minisign signatures for disk blog posts under `content/blog/` |
| [`elvishdkim`](../cmd/elvishdkim/) | Generate DKIM key + DNS TXT record |
| [`elvishrelay`](../cmd/elvishrelay/) | Generate optional Mode-C plaintext-relay PGP keypair |
| [`elvishmailtest`](../cmd/elvishmailtest/) | Mail subsystem integration / self-check CLI |
| [`apiroutes`](../cmd/apiroutes/) | Regenerate or verify `internal/apidoc/openapi.yaml` (`make openapi`, `make openapi-check`) |
| [`srpvector`](../cmd/srpvector/) | Print SRP test vectors (iOS / client crypto alignment) |

## `internal/` packages (grouped)

| Group | Packages | Notes |
|-------|----------|-------|
| HTTP / API | `httpserver`, `apidoc`, `render`, `config` | Routes, SSR, OpenAPI generation |
| SQL / auth | `db`, `store`, `session`, `pake`, `mfa`, `oauthoidc`, `ratelimit` | Migrations in `internal/db/migrations/` |
| Mail core | `mail`, `mailmeta`, `mailstore`, `mailworker`, `mailops`, `mailpipe`, `mailutil`, `maillinks` | Four-store split per ADR 0007 |
| Mail scale | `scyllastore`, `blobstore` | Scylla projections + S3 ciphertext blobs |
| SMTP | `smtp`, `smtpserver`, `smtpout`, `dkim` | In-tree mail transport (ADR 0006) |
| Crypto / keys | `openpgp`, `keyserver`, `envelope`, `relaykey` | PGP, WKD chain, protected links |
| Ops / telemetry | `telemetry`, `uptime`, `toolcalls`, `adminbootstrap` | Anonymous telemetry (ADR 0011), admin tools |
| Content | `blog`, `feeds`, `markdown`, `glyphs`, `migrate` | Blog, RSS/Atom, disk import |

## Browser UI split

| Layer | Location |
|-------|----------|
| Source (JSX, CSS, workers) | `static/mail/`, `static/admin/`, `static/auth/`, `static/shared/`, `static/protected/` |
| Build config | `frontend/build.mjs`, `frontend/entries/`, `frontend/package.json` |
| Shipped bundles (committed) | `static/dist/` — `mail-bundle.js`, `mail-admin-embed.js`, auth bundles, search worker |
| Vendored libs | `static/vendor/` (React dev builds, cap-widget, OpenPGP copy from build) |

Regenerate bundles: `make static-js` (or `make build`). CI verifies `static/dist/` matches sources (`lint-static-js`).

## Native clients

| Client | Path | API |
|--------|------|-----|
| iOS | [`IOS/`](../IOS/) | Same `/api/` + session cookie as browser |
| Android | [`flutter/elvish_mail/`](../flutter/elvish_mail/) | `ELVISH_API_BASE` dart-define |

Feature parity: [client-parity-roadmap.md](client-parity-roadmap.md).

## CI map

| Platform | Role |
|----------|------|
| **GitLab CI** ([`.gitlab-ci.yml`](../.gitlab-ci.yml)) | **Merge gate:** `gofmt`, `go vet`, golangci-lint + repo invariants, `apiroutes -check`, `static-js` freshness, `go test`, `go test -race`, Flutter analyze/test, `govulncheck`, Docker image build (`elvishapi`, `elvishmta`, `elvishworker`) |
| **GitHub Actions** ([`.github/workflows/`](../.github/workflows/)) | CodeQL (Go + JS), iOS `xcodebuild test` (macOS), Android workflow, optional docker publish |

Local equivalent of the GitLab lint/test stack: **`make check`** plus **`make check-clients`** on macOS.

Shared ADR invariant checks: [`scripts/lint-invariants.sh`](../scripts/lint-invariants.sh) (used by `make lint` and GitLab `lint-golangci`).

## Artifact policy

| Artifact | Policy |
|----------|--------|
| `frontend/package-lock.json` | Committed — use `npm ci` in `frontend/` |
| `frontend/node_modules/` | **Not** committed — install via `npm ci` |
| `static/dist/*.js` | Committed — production Docker copies `static/` as-is |
| `internal/apidoc/openapi.yaml` | Committed — regenerate with `make openapi`; verified with `make openapi-check` |
| `e2e/node_modules/` | Not committed |
| `/public/`, `/data/` | Not committed (local only) |

## Related docs

- [README.md](README.md) — documentation index
- [architecture.md](architecture.md) — system diagram
- [runbooks/split-deploy.md](runbooks/split-deploy.md) — four-process deploy and `make dev`
- [adr/README.md](adr/README.md) — ADRs 0001–0017
