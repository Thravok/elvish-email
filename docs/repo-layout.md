# Repository layout

Single-page map of the **ELVish** monorepo (Go module `elvish`). See [architecture.md](architecture.md) and [CODEBASES.md](../CODEBASES.md).

## Top-level tree

| Path | Role |
|------|------|
| [`libs/go/`](../libs/go/) | Shared Go libraries (httpserver, db, mail, smtp, …) |
| [`services/api/`](../services/api/) | `elvishapi` binary, SSR templates, marketing static, blog seed content |
| [`services/mta/`](../services/mta/) | `elvishmta` SMTP ingest |
| [`services/worker/`](../services/worker/) | `elvishworker` outbox + sweepers |
| [`apps/web/`](../apps/web/) | Mail/auth/protected browser app + `frontend/` esbuild + `dist/` |
| [`apps/admin/`](../apps/admin/) | Standalone operator console |
| [`packages/elvish-ui/`](../packages/elvish-ui/) | Shared React primitives (tokens, layout) |
| [`packages/elvish-client/`](../packages/elvish-client/) | `api-config.js` / `api-fetch.js` (copied to `apps/*/shared/` on build) |
| [`tools/`](../tools/) | CLIs: `apiroutes`, `elvishdb`, `elvishsign`, … |
| [`IOS/`](../IOS/) | SwiftUI iOS client |
| [`flutter/elvish_mail/`](../flutter/elvish_mail/) | Flutter Android client |
| [`docker/`](../docker/), [`docker-compose.yml`](../docker-compose.yml) | Compose + nginx configs for web/admin |
| [`docs/`](../docs/) | Specs, ADRs, runbooks |
| [`e2e/`](../e2e/) | Playwright smoke tests |

**Local-only:** [`data/`](../data/) (DKIM, MFA, relay keys).

## Binaries

| Command | Path |
|---------|------|
| `elvishapi` | [`services/api/cmd/elvishapi`](../services/api/cmd/elvishapi/) |
| `elvishmta` | [`services/mta/cmd/elvishmta`](../services/mta/cmd/elvishmta/) |
| `elvishworker` | [`services/worker/cmd/elvishworker`](../services/worker/cmd/elvishworker/) |

Migrations run on **api** only: [`libs/go/db/migrations/`](../libs/go/db/migrations/).

## Browser UI

| Layer | Location |
|-------|----------|
| Mail/auth sources | `apps/web/mail/`, `apps/web/auth/`, … |
| Operator UI | `apps/admin/src/` |
| esbuild (web) | `apps/web/frontend/build.mjs` |
| esbuild (admin) | `apps/admin/frontend/build.mjs` |
| Bundles | `apps/web/dist/`, `apps/admin/dist/` |

Regenerate: `make static-js`. Production split-origin: [ADR 0018](adr/0018-monorepo-split-origin-deploy.md).

## Deploy images

| Role | Dockerfile |
|------|------------|
| api | `services/api/Dockerfile` |
| web | `apps/web/Dockerfile` |
| admin | `apps/admin/Dockerfile` |
| mta | `services/mta/Dockerfile` |
| worker | `services/worker/Dockerfile` |

## CI

Primary: [`.gitlab-ci.yml`](../.gitlab-ci.yml). GitHub: CodeQL, native clients under [`.github/workflows/`](../.github/workflows/).
