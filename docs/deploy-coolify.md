# Deploying ELVish on Coolify (Docker Compose)

Coolify treats [`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml) as the **single source of truth**. Configure domains in the Coolify UI; do not rely on in-repo Traefik labels.

## Services overview

| Service | Public access | Container port | Notes |
|---------|---------------|------------------|--------|
| `api` | Coolify domain | **8765** | Static site, SSR, and JSON API (`elvishapi`); health: `/api/healthz` |
| `docs` | Coolify domain | **8080** | MkDocs static documentation (`docker/docs/Dockerfile`); no app secrets |
| `mail-mta` | **Host ports** `25`, `587` | 25 / 587 | No HTTP domain; MX DNS → server IP |
| `worker` | Internal only | — | `elvishworker`: outbox + sweepers; scale to **one** replica |
| `cockroach`, `valkey`, `scylla`, `minio` | Optional admin domains | 8080 / — / 9042 / 9001 | Internal only by default |

There is **no** separate nginx or static-only container. Browsers use one origin on `api` (same-origin `/api/*`; `static/shared/api-config.js` keeps an empty `__ELVISH_API_BASE__` in the image).

## One-time Coolify setup

### 1. Create the stack

Import the repo and select **Docker Compose** with `docker-compose.coolify.yaml`.

### 2. Assign domains (HTTP services)

In the stack **Domains** UI:

| Service | Example domain field | Why |
|---------|----------------------|-----|
| `api` | `https://app.example.com:8765` | Listens on port **8765** (include `:8765` in the domain field) |
| `docs` | `https://docs.example.com:8080` | Optional internal docs site; include `:8080` in the domain field |

Coolify generates **magic variables from the compose service name** (hyphen + port when not 80, e.g. `SERVICE_URL_API_8765`):

| Magic variable | Shape | Example use in this stack |
|----------------|--------|---------------------------|
| `SERVICE_URL_API_8765` | Full URL | Default `ELVISH_PUBLIC_BASE_URL` and `ELVISH_WEB_ORIGINS` on `api` |
| `SERVICE_FQDN_API` | Hostname only | DNS / debugging; use `SERVICE_URL_*` for browser and OIDC bases |

### 3. Required environment variables (Coolify UI)

These use `${VAR:?}` in compose and show a **red border** until set:

| Variable | Example |
|----------|---------|
| `ELVISH_MAIL_DOMAIN` | `mail.example.com` |
| `COOKIE_SECURE` | `1` (production HTTPS) |

`ELVISH_COOKIE_DOMAIN` is optional for single-origin deploys (leave empty). Set it (e.g. `.example.com`) only if you intentionally split app and API across different registrable domains.

### 4. Recommended overrides

| Variable | Where | Value |
|----------|-------|--------|
| `worker` service | Deploy enabled | Outbox delivery; do not run multiple workers until leader lock exists |
| `ELVISH_WEB_ORIGINS` | `api` | Usually leave default `$SERVICE_URL_API_8765` after the `api` domain is assigned |
| `ELVISH_PUBLIC_BASE_URL` | `api` | Usually leave default `$SERVICE_URL_API_8765` |

### 5. SMTP (`mail-mta`)

- Compose publishes **25** and **587** on the host (required; Coolify HTTP proxy does not carry SMTP).
- Point MX / submission DNS at this server's public IP.
- For a **second** MTA node, deploy another Coolify server (or enable compose profile `dual-mta`); two containers cannot both bind host port 25 on one machine.
- Mount shared `elvish_data` (or replicate DKIM/relay keys) so all MTAs sign consistently.

### 6. Health checks (Coolify UI)

| Service | Path | Port |
|---------|------|------|
| `api` | `/api/healthz` | 8765 |

`mail-mta` has HTTP disabled by default (`ELVISH_HTTP_ENABLED=0`). Use TCP checks on 25/587 or set `ELVISH_HTTP_ENABLED=1` for HTTP health on 8765.

### 7. Scaling `api`

- Increase replica count in Coolify for `api` only.
- Run **one** `worker` replica for outbox and sweepers.
- `mail-mta` runs outbound SMTP workers on the MTA tier; `LeasePendingOutbox` is safe across workers.

## Magic variables declared in compose

Declared on `api` (reused stack-wide per Coolify rules):

- `SERVICE_URL_API_8765`, `SERVICE_FQDN_API`
- `SERVICE_PASSWORD_64_VALKEY`, `SERVICE_USER_MINIO`, `SERVICE_PASSWORD_64_MINIO`
- `SERVICE_BASE64_64` (MFA key seed material)

Compose env syntax follows [`.cursor/rules/docker-compose-coolify.mdc`](../.cursor/rules/docker-compose-coolify.mdc): `${VAR:?}` for required secrets, `${VAR:-default}` for optional values, and `$SERVICE_URL_*` for generated URLs — not hardcoded hostnames in the file.

## Init jobs

`scylla-init` and `minio-init` use `exclude_from_hc: true` so one-shot containers do not fail stack health.

## Related

- [ADR 0017](adr/0017-mandatory-split-deployment.md) — mandatory split
- [runbooks/split-deploy.md](runbooks/split-deploy.md) — ports and scaling
- [README.md](../README.md) — env reference
