# Agent notes (ELVish)

This repository implements **ELVish**: split Go services (`elvishapi`, `elvishmta`, `elvishworker`; module **`elvish`**). `elvishapi` serves static, API, and SSR. E2EE mail, Valkey-backed sessions, and browser / iOS / Flutter (Android) clients.

**Read first**

1. [docs/README.md](docs/README.md) — documentation map and “where things live”.
2. [docs/repo-layout.md](docs/repo-layout.md) — top-level tree, `cmd/` / `internal/` index, CI and artifact policy.
3. [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md) — four-process layout, ports, `make dev`, Coolify scaling.
4. [docs/architecture.md](docs/architecture.md) — data planes and high-level diagram.
5. [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md) — web / iOS / Android feature matrix and tiers (update when changing native clients).
6. Relevant [docs/adr/](docs/adr/) entries for mail, storage, or privacy changes (including [ADR 0017](docs/adr/0017-mandatory-split-deployment.md)).

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
