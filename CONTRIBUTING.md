# Contributing to ELVish

Thank you for helping improve this project. This file is the short path for **local setup, checks, and where code lives**. Operational detail (every env var, Docker ports) stays in the root [README.md](README.md).

Pull requests and focused issues are welcome. Please keep changes aligned with existing docs and ADRs for mail, storage, and privacy. **Security-sensitive reports** should not go through public issues; use [SECURITY.md](SECURITY.md) instead. **Conduct:** follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Continuous integration runs on **GitLab CI** via [.gitlab-ci.yml](.gitlab-ci.yml) (`gofmt`, `go vet`, `golangci-lint`, [`scripts/lint-invariants.sh`](scripts/lint-invariants.sh), OpenAPI check, `lint-static-js` bundle freshness, `go test` / `go test -race`, Flutter client tests, release build of `elvishapi`/`elvishmta`/`elvishworker`, and optional stages defined there). **GitHub Actions** runs CodeQL, iOS, and Android workflows — see [docs/repo-layout.md](docs/repo-layout.md#ci-map). Issue and merge request description templates live under [.gitlab/issue_templates/](.gitlab/issue_templates/) and [.gitlab/merge_request_templates/](.gitlab/merge_request_templates/).

**Dependency updates (Renovate, free):** [Renovate](https://docs.renovatebot.com/) is the usual Dependabot-like option on GitLab. This repo includes [renovate.json](renovate.json) plus a scheduled **child pipeline** ([.gitlab/ci/renovate-child.gitlab-ci.yml](.gitlab/ci/renovate-child.gitlab-ci.yml)) so Renovate does not run the full CI graph. To enable it: **Settings → Access tokens** (or a bot user) → create a **project access token** with scopes **`api`** and **`write_repository`**; add it as a masked CI variable **`RENOVATE_TOKEN`**. **Build → Pipeline schedules** → new schedule on the default branch → add variable **`RENOVATE_SCHEDULE`** = **`true`**. Optionally set **`RENOVATE_EXTRA_ARGS`** (e.g. `--dry-run`) while testing. For GitLab.com you can instead install the hosted **Mend Renovate** GitLab app if you prefer not to use a long-lived token in CI.

## Prerequisites

- **Go** — version in [go.mod](go.mod) (`go` directive).
- **Docker** — for `make db-up` (CockroachDB/Postgres wire, Valkey, Scylla, MinIO).
- **fswatch** (optional) — `brew install fswatch` if you use `make dev` with auto-restart.
- **Node.js + npm** — for Playwright E2E under [e2e/](e2e/) (`make test-e2e`), and for **browser UI bundles** (`make static-js` / `make build`; see [frontend/](frontend/)).

## Common commands

From the repository root:

| Command | Purpose |
|---------|---------|
| `make dev` | Split stack via Overmind ([Procfile](Procfile)) or `scripts/dev-split.sh`; runs `make db-up` unless `SKIP_AUTO_DB_UP=1`. App on :8765. |
| `make dev-api-once` | API + browser tier (`elvishapi` on `PORT`, default 8765). |
| `make dev-mta-once` / `make dev-worker-once` | SMTP or worker role only. |
| `make dev-once` | Alias for `make dev-api-once`. Run `make static-js` after editing [static/mail/](static/mail/) or [frontend/](frontend/). |
| `make db-up` / `make db-down` | Start/stop local Docker backends. |
| `make build` | Run `make static-js` (unless `SKIP_STATIC_JS=1`), then produce `bin/elvish`. |
| `make static-js` | Install `frontend/node_modules` on first use (`npm ci`), copy vendored OpenPGP 6, emit `static/dist/*.js` from [frontend/build.mjs](frontend/build.mjs). |
| `make fmt` | Fail if `gofmt` would change files. |
| `make vet` | `go vet ./...` |
| `make lint` | golangci-lint plus repo-specific guards (see Makefile). |
| `make test` | `go test ./...` |
| `make test-race` | `go test -race ./...` |
| `make test-integration` | Docker-backed Cockroach tests (`ELVISH_INTEGRATION_DB=1`). |
| `make test-mail-e2e` | Mail bootstrap self-checks against local compose stack. |
| `make test-e2e` | Playwright (requires server already running; see [e2e/README.md](e2e/README.md)). |
| `make openapi` | Regenerate `internal/apidoc/openapi.yaml` from `internal/httpserver/api.go` + `docs/openapi/supplemental.yaml`. |
| `make openapi-check` | Fail if the committed OpenAPI spec is out of date (runs in `make check` / CI). |
| `make check` | `fmt` + `vet` + `lint` + `static-js` + `openapi-check` + `test-race` + `govulncheck`. |
| `make test-flutter` | `flutter analyze` + `flutter test` in [flutter/elvish_mail/](flutter/elvish_mail/). |
| `make test-ios` | `xcodebuild test` for [IOS/](IOS/) (macOS + Xcode only). |
| `make check-clients` | `test-flutter`; on macOS also `test-ios`. |
| `make codeql` / `make codeql-go` | Local CodeQL for Go (same config + MaD pack as CI). Requires [CodeQL CLI](https://github.com/github/codeql-action/releases) (`brew install codeql`). Uses `make codeql-build` as the traced command. |
| `make codeql-js` | Local CodeQL for `static/` and other JS/TS under server config paths. |
| `make codeql-all` | Go + JavaScript databases. |
| `make codeql-summary-go` | Text summary of Go findings after `make codeql-go`. |
| `make codeql-clean` | Remove `.codeql/` artifacts. |

**In Cursor / VS Code:** **Terminal → Run Task…** → **CodeQL: Go** (or **CodeQL: Go + summary**). Installs the [CodeQL extension](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-codeql) when prompted via `.vscode/extensions.json`.

## Browser mail UI (acceptance framing)

Changes under [static/mail/](static/mail/) and the [frontend/](frontend/) bundle should improve **maintainability** (smaller modules, shared helpers, one build pipeline), **performance** (production React bundle, no in-browser transpile, reasonable worker usage), and **usability** (keyboard triage, clear decrypt/error states, accessible controls) without weakening documented trust boundaries ([docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md), relevant ADRs). Large refactors are acceptable when they advance those goals together.

## Browser UI security (library-agnostic)

React vs vanilla does **not** replace these controls. When changing mail, auth, admin, or CSP, keep them explicit:

| Control | Where it lives |
|---------|------------------|
| **Server authorization** | Handlers under [internal/httpserver/](internal/httpserver/) (e.g. admin and mail routes must not trust client-only flags). |
| **CSP and page headers** | [internal/httpserver/secure_page_headers.go](internal/httpserver/secure_page_headers.go); invariant tests in [internal/httpserver/secure_surfaces_test.go](internal/httpserver/secure_surfaces_test.go). |
| **MIME / HTML safety** | Mail read and compose paths under [static/mail/](static/mail/) (no raw HTML from untrusted mail without sandbox + sanitizer); align with [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md). |
| **Dependency pinning** | [frontend/package.json](frontend/package.json); rebuild with `make static-js` / `make check`. Vendor scripts: self-hosted only on secure shells; refresh **Subresource Integrity** on OpenPGP vendor bumps (see comment in [frontend/build.mjs](frontend/build.mjs)). |

## Conventions

- **Go:** follow [.cursor/rules/go-guidelines.mdc](.cursor/rules/go-guidelines.mdc) (errors, structure, tests, HTTP boundaries).
- **Security:** do not log secrets, passwords, session tokens, or raw mail bodies. Prefer generic client messages for auth failures. Validate sizes and shapes at HTTP boundaries.
- **Design alignment:** mail and privacy trade-offs are documented in [docs/](docs/) and ADRs; large behavior changes should update the relevant ADR or spec.

## Repository layout

See [docs/repo-layout.md](docs/repo-layout.md) for the full top-level tree, `cmd/` inventory, `internal/` package groups, CI map, and what is (not) committed (`static/dist/`, `node_modules`, `/public/`, `/data/`).

## Where to change what

| Area | Typical paths |
|------|-----------------|
| HTTP / JSON API | `internal/httpserver/` |
| SQL schema and queries | `internal/db/`, migrations in `internal/db/migrations/` |
| Sessions / rate limits | `internal/session/`, `internal/ratelimit/`, Valkey usage |
| Mail metadata / identities | `internal/mailmeta/`, related API handlers in `internal/httpserver/` |
| Mail pipeline / workers | `internal/mail/`, `internal/mailworker/`, `internal/mailops/`, `internal/mailstore/` |
| SMTP (inbound/outbound) | `internal/smtp/`, `internal/smtpserver/`, `internal/smtpout/` |
| Browser mail UI | `static/mail/`, [frontend/](frontend/) (esbuild: `mail-bundle.js`, lazy `mail-admin-embed.js` for embedded admin → `static/dist/`) |
| iOS app | `IOS/` (see [IOS/README.md](IOS/README.md), [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md)) |
| Android (Flutter) mail | `flutter/elvish_mail/` (see [flutter/elvish_mail/README.md](flutter/elvish_mail/README.md), [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md)) |

When in doubt, search for the route or env var in `internal/` and follow existing patterns.
