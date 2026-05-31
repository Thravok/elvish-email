# Contributing to ELVish

Thank you for helping improve this project. **Local setup and code map:** [CODEBASES.md](CODEBASES.md), [docs/repo-layout.md](docs/repo-layout.md). Env vars and Docker ports: [README.md](README.md).

Pull requests welcome. Align with [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md) and relevant ADRs. Security: [SECURITY.md](SECURITY.md). Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

CI: [.gitlab-ci.yml](.gitlab-ci.yml) (`gofmt`, `vet`, `golangci-lint`, `lint-invariants`, `lint-import-boundaries`, OpenAPI check, `lint-static-js`, docs, tests, multi-image build). GitHub: CodeQL, iOS, Android — see [docs/repo-layout.md](docs/repo-layout.md).

## Prerequisites

- **Go** — [go.mod](go.mod)
- **Docker** — `make db-up`
- **Node.js** — `make static-js` (apps/web/frontend)
- **fswatch** (optional) — `make dev-watch`

## Common commands

| Command | Purpose |
|---------|---------|
| `make dev` | api :8765 (marketing + mail + API), mta, worker ([Procfile](Procfile)) |
| `make dev-api-once` / `make dev-mta-once` / `make dev-worker-once` | Single Go role |
| `make static-js` | Bundles → `apps/web/dist/`, `apps/admin/dist/` |
| `make build` | `static-js` + `bin/elvishapi`, `elvishmta`, `elvishworker` |
| `make test` / `make lint` / `make check` | Standard gates |
| `make openapi` | Regenerate `libs/go/apidoc/openapi.yaml` |

## Where to change what

| Area | Path |
|------|------|
| HTTP / API | `libs/go/httpserver/` |
| SQL | `libs/go/db/`, migrations in `libs/go/db/migrations/` |
| Mail pipeline | `libs/go/mail*`, `libs/go/mailworker/` |
| SMTP | `libs/go/smtp/` |
| Mail UI | `apps/web/mail/`, build `apps/web/frontend/` |
| Operator UI | `apps/admin/src/` |
| Shared UI | `packages/elvish-ui/` |
| API client helpers | `packages/elvish-client/` |

## Conventions

- **Go:** [.cursor/rules/go-guidelines.mdc](.cursor/rules/go-guidelines.mdc)
- **Browser:** [.cursor/rules/browser-ui.mdc](.cursor/rules/browser-ui.mdc)
- **Mail:** [.cursor/rules/mail-subsystem.mdc](.cursor/rules/mail-subsystem.mdc)
- Do not log secrets or mail bodies; update ADRs for trust-boundary changes.
