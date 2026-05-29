# ADR 0018 — Monorepo layout and split-origin deploy

**Status:** Accepted (2026-05)

**Supersedes:** Browser-tier sections of [0017](0017-mandatory-split-deployment.md) for production defaults.

## Context

ELVish needed service-owned codebases, shared libraries, separate container images, and production split origins (api / web / admin) per industry practice.

## Decision

1. **Layout** — `libs/go/*` shared libraries; `services/{api,mta,worker}` Go binaries; `apps/{web,admin}` browser apps; `packages/{elvish-ui,elvish-client}`; `tools/*` CLIs.

2. **Production origins** — `elvishapi` serves `/api/*`, SSR marketing, and well-known only (`ELVISH_SERVE_STATIC=0`). `web` and `admin` nginx images serve mail/auth and operator UI. Session cookies use `ELVISH_COOKIE_DOMAIN`.

3. **UI canonical source** — `apps/web` (from former `static/` + `frontend/`). Operator panel is standalone at `apps/admin` (not mail-embedded in split deploy).

4. **Paths** — `-root` is repository root; [`libs/go/paths`](../libs/go/paths/paths.go) resolves `services/api/content`, `apps/web`, etc.

## Consequences

- Coolify runs at least **api**, **web**, **admin**, **mail-mta**, **worker**.
- Local full stack: `docker compose --profile full` or `make dev` with optional web/admin processes.
- Import rule: services must not import each other’s `internal/`; use `libs/go` only.

## Related

- [docs/runbooks/split-deploy.md](../runbooks/split-deploy.md)
- [CODEBASES.md](../../CODEBASES.md)
