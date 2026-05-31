# ADR 0015 — Multi-service deployment (API, frontend, mail-mta)

**Status:** Superseded by [0017](0017-mandatory-split-deployment.md)

## Context

`elvishserver` previously ran HTTP, static assets, SMTP (MX + submission), and mail workers in one process and one Coolify service. We need independent scaling of the browser tier, JSON API, and mail transport, including two MTA instances in production.

## Decision

1. **Single binary, component flags** — Keep `cmd/elvishserver` and gate subsystems with `ELVISH_COMPONENT` (`api`, `mta`, `all`):
   - `api`: HTTP only; SMTP env cleared; `mailworker` on; background sweepers only when `ELVISH_BACKGROUND_JOBS=1`.
   - `mta`: SMTP + `mailworker`; HTTP off unless `ELVISH_HTTP_ENABLED=1` (health checks).
   - `all`: legacy monolith behavior (default when unset).

2. **Coolify compose** — [`docker-compose.coolify.yaml`](../../docker-compose.coolify.yaml) defines `api`, `web`, `admin`, `mail-mta`, and `worker`. Domains and TLS are configured in the Coolify UI per service, not in-repo. See [`docs/deploy-coolify.md`](../deploy-coolify.md).

3. **Browsers** — Default is single-origin on the `api` Coolify domain (`SERVICE_URL_API_8765`). Optional split-origin uses `ELVISH_WEB_ORIGINS` and `ELVISH_COOKIE_DOMAIN` without a separate static container.

4. **Shared DKIM/relay volume** — `elvish_data` is mounted on `api` and `mail-mta` services so outbound signing keys stay consistent.

5. **Health** — `GET /api/healthz` for Coolify HTTP checks on `api`.

## Consequences

- Operators assign one Coolify domain on `api` (include `:8765`) and publish SMTP ports on `mail-mta`.
- Two MTAs on one host cannot both bind port 25; use two servers or DNS to distinct IPs.
- Horizontal API replicas must set `ELVISH_BACKGROUND_JOBS=1` on exactly one instance until a Valkey leader lock exists.
- Outbox delivery remains safe across workers (`LeasePendingOutbox` uses `FOR UPDATE SKIP LOCKED`).

## Related

- [architecture.md](../architecture.md)
- [ADR 0006](./0006-own-smtp-stack.md)
- [ADR 0007](./0007-four-store-mail-architecture.md)
