# Agent notes (ELVish)

This repository implements **ELVish**: a Go HTTP server (`cmd/elvishserver`, module **`elvish`**) with optional E2EE mail, Valkey-backed sessions, and browser / iOS / Flutter (Android) clients.

**Read first**

1. [docs/README.md](docs/README.md) — documentation map and “where things live”.
2. [docs/architecture.md](docs/architecture.md) — data planes and high-level diagram.
3. [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md) — web / iOS / Android feature matrix and tiers (update when changing native clients).
4. Relevant [docs/adr/](docs/adr/) entries for mail, storage, or privacy changes.

**Contributing**

- [CONTRIBUTING.md](CONTRIBUTING.md) — Make targets, tests, and path-oriented guidance.
- Local CodeQL: `make codeql-go` or Cursor task **CodeQL: Go** (`.vscode/tasks.json`); see [.github/codeql/README.md](.github/codeql/README.md).
- [.cursor/rules/go-guidelines.mdc](.cursor/rules/go-guidelines.mdc) — Go style and review expectations.
- [.cursor/rules/skiff-whitepaper-reference.mdc](.cursor/rules/skiff-whitepaper-reference.mdc) — background for secure email architecture discussions (align with repo ADRs/spec first).

**Product runbook**

- Root [README.md](README.md) — local Docker stack, env vars, deploy notes.

Do not log or persist secrets from user sessions. Prefer updating ADRs or [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md) when changing trust boundaries.
