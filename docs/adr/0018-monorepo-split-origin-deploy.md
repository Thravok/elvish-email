# ADR 0018 — Monorepo layout and split-origin deploy

**Status:** Accepted (2026-05); **amended 2026-05** — single-origin is the production default again (see below).

**Supersedes:** Browser-tier sections of [0017](0017-mandatory-split-deployment.md) for production defaults.

## Context

ELVish needed service-owned codebases, shared libraries, and separate container images per role. Split-origin nginx tiers (`web`, `admin`) remain available but are **not** required for production.

## Decision

1. **Layout** — `libs/go/*` shared libraries; `services/{api,mta,worker}` Go binaries; `apps/{web,admin}` browser apps; `packages/{elvish-ui,elvish-client}`; `tools/*` CLIs.

2. **Production origins (default)** — `elvishapi` serves marketing SSR, mail/auth UI, and `/api/*` on one domain (`ELVISH_SERVE_STATIC=1`). The `api` Docker image bundles prebuilt `apps/web` assets.

3. **Split-origin (optional)** — Compose profile `split-origin` enables separate nginx `web` / `admin` containers with `ELVISH_SERVE_STATIC=0` on `api` and `ELVISH_WEB_ORIGIN` / `ELVISH_ADMIN_ORIGIN` redirects.

4. **Paths** — `-root` is repository root; [`libs/go/paths`](../libs/go/paths/paths.go) resolves `services/api/content`, `apps/web`, etc.

## Consequences

- Coolify runs **api**, **mail-mta**, **worker** by default (one public HTTP domain on `api`).
- Split-origin: enable `COMPOSE_PROFILES=split-origin` and assign domains on `web` / `admin`.
- Local dev: `make dev` (api + mta + worker). Import rule: services must not import each other’s `internal/`; use `libs/go` only.

## Related

- [docs/runbooks/split-deploy.md](../runbooks/split-deploy.md)
- [CODEBASES.md](../../CODEBASES.md)
