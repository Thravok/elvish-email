# ADR 0017 — Mandatory split deployment (api, mta, worker)

**Status:** Accepted (2026-05)

**Supersedes:** [0015](0015-multi-service-deployment.md) (component flags and `all` monolith mode). See also [0016](0016-operator-settings-in-sql.md) (unrelated).

## Context

ADR 0015 introduced `ELVISH_COMPONENT` on a single `elvishserver` binary. Operators still ran one process by default; API and MTA both started `mailworker`, coupling HTTP scale to outbound delivery. We want an industry-standard **one role per process** layout with a dedicated worker tier.

## Decision

1. **Three binaries** — [`cmd/elvishapi`](../../cmd/elvishapi/), [`cmd/elvishmta`](../../cmd/elvishmta/), [`cmd/elvishworker`](../../cmd/elvishworker/). Shared boot logic in [`internal/elvishboot`](../../internal/elvishboot/). `elvishserver` is removed (stub exits with a hint).

2. **Role matrix (fixed per binary)**

   | Role | HTTP | SMTP | mailworker | Background sweepers | SQL migrations |
   |------|------|------|------------|---------------------|----------------|
   | `elvishapi` | yes | no | no | no | yes |
   | `elvishmta` | optional health only | yes | no | no | no |
   | `elvishworker` | no | no | yes | yes | no |

   MTA HTTP: only when `ELVISH_HTTP_ENABLED=1`, serving `/api/healthz` (no full API surface).

3. **Browser tier** — `elvishapi` serves `static/`, SSR, and `/api/*` on one listen address (default `:8765`). Same-origin fetches use an empty `__ELVISH_API_BASE__` in `static/shared/api-config.js`. Optional split-origin (separate API hostname) is operator-driven via `ELVISH_WEB_ORIGINS` / `ELVISH_COOKIE_DOMAIN`; Coolify defaults use `$SERVICE_URL_API_8765` only.

4. **Local dev** — `make dev` runs api, mta, and worker via [Overmind](https://github.com/DarthSim/overmind) and [Procfile](../../Procfile), or `scripts/dev-split.sh`. App on `:8765`.

5. **`ELVISH_COMPONENT`** — optional cross-check only; must match the binary if set. Values `all` and comma-separated lists are rejected.

## Consequences

- Every deployment runs **at least three processes**: api, mta, worker.
- Scale API horizontally without multiplying outbox workers; run **one** worker replica until a Valkey leader lock exists.
- Coolify / compose must include the `worker` service and shared `elvish_data` volume for DKIM/relay keys.
- Docs and Make targets refer to `elvishapi` / `make dev-api-once`, not monolithic `elvishserver`.

## Related

- [docs/runbooks/split-deploy.md](../runbooks/split-deploy.md)
- [0015](0015-multi-service-deployment.md) (historical)
- [0007](0007-four-store-mail-architecture.md)
