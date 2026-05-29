# Agent notes (ELVish)

This repository implements **ELVish**: split Go services (`elvishapi`, `elvishmta`, `elvishworker`; module **`elvish`**). Shared code lives in `libs/go/`; browser apps in `apps/web` and `apps/admin`. Production uses split origins (api + web + admin). E2EE mail, Valkey-backed sessions, and browser / iOS / Flutter clients.

**Read first**

1. [CODEBASES.md](CODEBASES.md) — where to change api, mail UI, admin, migrations.
2. [docs/README.md](docs/README.md) — documentation map.
3. [docs/repo-layout.md](docs/repo-layout.md) — monorepo tree and CI map.
4. [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md) — five deployables, ports, `make dev`, Coolify.
4. [docs/architecture.md](docs/architecture.md) — data planes and high-level diagram.
5. [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md) — web / iOS / Android feature matrix and tiers (update when changing native clients).
6. [docs-site/](docs-site/) — MkDocs static documentation site (`make docs-serve`, `docs` compose service).
7. Relevant [docs/adr/](docs/adr/) entries (including [ADR 0017](docs/adr/0017-mandatory-split-deployment.md), [ADR 0018](docs/adr/0018-monorepo-split-origin-deploy.md)).

**Contributing**

- [CONTRIBUTING.md](CONTRIBUTING.md) — Make targets, tests, and path-oriented guidance.
- Local CodeQL: `make codeql-go` or Cursor task **CodeQL: Go** (`.vscode/tasks.json`); see [.github/codeql/README.md](.github/codeql/README.md).

**Cursor rules** (`.cursor/rules/`):

| Rule | Scope |
|------|-------|
| [go-guidelines.mdc](.cursor/rules/go-guidelines.mdc) | Go style, errors, testing, security |
| [mail-subsystem.mdc](.cursor/rules/mail-subsystem.mdc) | E2EE mail, four-store architecture, invariants |
| [smtp-dkim.mdc](.cursor/rules/smtp-dkim.mdc) | In-tree SMTP stack and DKIM signing |
| [browser-ui.mdc](.cursor/rules/browser-ui.mdc) | JSX/JS, frontend build, security controls |
| [native-clients.mdc](.cursor/rules/native-clients.mdc) | iOS/Flutter, crypto alignment, parity |
| [adr-workflow.mdc](.cursor/rules/adr-workflow.mdc) | When/how to create or update ADRs |
| [codeql-local.mdc](.cursor/rules/codeql-local.mdc) | Local CodeQL scanning |
| [skiff-whitepaper-reference.mdc](.cursor/rules/skiff-whitepaper-reference.mdc) | Background context (repo ADRs take precedence) |

**Product runbook**

- Root [README.md](README.md) — local Docker stack, env vars, deploy notes.

Do not log or persist secrets from user sessions. Prefer updating ADRs or [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md) when changing trust boundaries.
