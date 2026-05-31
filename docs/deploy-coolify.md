# Deploying ELVish on Coolify (Docker Compose)

Coolify treats [`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml) as the **single source of truth**. Configure domains in the Coolify UI; do not rely on in-repo Traefik labels.

## Services overview

| Service | Public access | Container port | Notes |
|---------|---------------|------------------|--------|
| `api` | Coolify domain | **8765** | JSON API + SSR marketing (`elvishapi`, `ELVISH_SERVE_STATIC=0`); health: `/api/healthz` |
| `web` | Coolify domain | **8080** | Mail/auth nginx (`apps/web/Dockerfile`); health: `/healthz` |
| `admin` | Coolify domain | **8080** | Operator console nginx (`apps/admin/Dockerfile`); health: `/healthz` |
| `docs` | Coolify domain (profile `docs` only) | **8080** | MkDocs static site (`ghcr.io/thravok/elvish-email/docs:main`); optional |
| `mail-mta` | **Host ports** `25`, `587` | 25 / 587 | No HTTP domain; MX DNS → server IP |
| `worker` | Internal only | — | `elvishworker`: outbox + sweepers; scale to **one** replica |
| `cockroach`, `valkey`, `scylla`, `minio` | **None** (internal) | — | Reachable only as `cockroach:26257`, `valkey:6379`, `scylla:9042`, `minio:9000`. Do **not** assign Coolify domains or declare `SERVICE_URL_*` on these services. |

Split-origin is the default: assign domains on **`web`** and **`admin`** for browser UIs; **`api`** for `/api/*`. Set `ELVISH_COOKIE_DOMAIN` (e.g. `.example.com`) so session cookies work across subdomains.

## Container images (GHCR)

Coolify **pulls** pre-built role images (no on-server Go/nginx builds for app tiers):

| Role | Image |
|------|--------|
| `api` | `ghcr.io/thravok/elvish-email/api:main` |
| `web` | `ghcr.io/thravok/elvish-email/web:main` |
| `admin` | `ghcr.io/thravok/elvish-email/admin:main` |
| `worker` | `ghcr.io/thravok/elvish-email/worker:main` |
| `mail-mta` | `ghcr.io/thravok/elvish-email/mta:main` |

Published on every push to `main` ([`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)). Set **`ELVISH_IMAGE_TAG`** in Coolify to pin another tag (e.g. `v1.2.3` or a commit SHA).

`web` and `admin` write `shared/api-config.js` at container start from `ELVISH_API_BASE` / `ELVISH_ADMIN_ORIGIN` (defaults use Coolify `$SERVICE_URL_*` magic vars). The repo still supplies bind-mounted init scripts (`scylla-init`, `minio-init`, nginx entrypoints).

`docs` is **off by default** (compose profile `docs`). Image: `ghcr.io/thravok/elvish-email/docs:main` after CI publishes it. Enable with `COMPOSE_PROFILES=docs` in Coolify only if you want the docs site.

If packages are private, add a GHCR registry credential in Coolify before deploy.

## One-time Coolify setup

### 1. Create the stack

Import the repo and select **Docker Compose** with `docker-compose.coolify.yaml` (compose file + init bind mounts; app images from GHCR).

### 2. Assign domains (HTTP services)

In the stack **Domains** UI:

| Service | Example domain field | Why |
|---------|----------------------|-----|
| `api` | `https://api.example.com:8765` | JSON API + SSR; include `:8765` in the domain field |
| `web` | `https://mail.example.com:8080` | Mail/auth UI; include `:8080` in the domain field |
| `admin` | `https://admin.example.com:8080` | Operator console; include `:8080` in the domain field |
| `docs` | `https://docs.example.com:8080` | Optional internal docs site; include `:8080` in the domain field |

Coolify generates **magic variables from the compose service name** (hyphen + port when not 80, e.g. `SERVICE_URL_API_8765`):

| Magic variable | Shape | Example use in this stack |
|----------------|--------|---------------------------|
| `SERVICE_URL_API_8765` | Full URL | `ELVISH_API_BASE` on `web` / `admin` (runtime `api-config.js`) |
| `SERVICE_URL_WEB_8080` | Full URL | Default `ELVISH_WEB_ORIGIN`, `ELVISH_PUBLIC_BASE_URL`, CORS on `api` |
| `SERVICE_URL_ADMIN_8080` | Full URL | Default `ELVISH_ADMIN_ORIGIN` on `api` and `web` build |
| `SERVICE_FQDN_*` | Hostname only | DNS / debugging; use `SERVICE_URL_*` for browser and OIDC bases |

### 3. Required environment variables (Coolify UI)

Compose uses `${VAR:?}` so Coolify shows a **red border** until the value exists. Assign **domains** on `api`, `web`, and `admin` first — that populates the `SERVICE_URL_*` / `SERVICE_FQDN_*` magic vars below.

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `COOKIE_SECURE` | `api` | `${COOKIE_SECURE:?1}` | Use `1` in production (HTTPS cookies) |
| `SERVICE_URL_WEB_8080` | `api`, `web` | via domain on **web** | Defaults `ELVISH_PUBLIC_BASE_URL`, `ELVISH_WEB_ORIGIN`, CORS |
| `SERVICE_URL_ADMIN_8080` | `api`, `web` | via domain on **admin** | Defaults `ELVISH_ADMIN_ORIGIN`, CORS |
| `SERVICE_URL_API_8765` | `web`, `admin` | via domain on **api** | Defaults `ELVISH_API_BASE` in runtime `api-config.js` |
| `SERVICE_FQDN_WEB` | `api`, `mail-mta` | via domain on **web** | Defaults `ELVISH_MAIL_DOMAIN` when unset |
| `SERVICE_PASSWORD_64_VALKEY` | `valkey` (+ consumers) | auto-generated | Declared on `valkey`; required on `api` / `worker` / `mail-mta` via `:?` |
| `SERVICE_USER_MINIO` / `SERVICE_PASSWORD_64_MINIO` | `minio` (+ consumers) | auto-generated | Blob credentials; `minio-init` creates the bucket |
| `SERVICE_BASE64_64` | `api` (+ worker/mta) | auto-generated | MFA encryption key material |

**Recommended (not `:?` in compose):** `ELVISH_COOKIE_DOMAIN` (e.g. `.example.com`) when `web`, `admin`, and `api` use different hostnames.

**Internal data stores** (no `SERVICE_URL_*` — Docker DNS defaults; override only for predefined-network deploys):

| Variable | Default | Used by |
|----------|---------|---------|
| `COCKROACH_DSN` | `postgres://root@cockroach:26257/defaultdb?sslmode=disable` | `api`, `worker`, `mail-mta` |
| `VALKEY_ADDR` | `valkey:6379` | same |
| `SCYLLA_HOSTS` | `scylla:9042` | same; **`scylla-init`** applies schema |
| `SCYLLA_KEYSPACE` | `elvish_mail` | same + `scylla-init` |
| `BLOB_S3_ENDPOINT` | `http://minio:9000` | same; **`minio-init`** creates bucket |
| `SCYLLA_SMP` / `SCYLLA_MEMORY` | `2` / `2G` | `scylla` tuning (Coolify UI) |
| `COCKROACH_CACHE` / `COCKROACH_MAX_SQL_MEMORY` | `256MiB` | `cockroach` tuning |

### 4. Recommended overrides

| Variable | Where | Value |
|----------|-------|--------|
| `worker` service | Deploy enabled | Outbox delivery; do not run multiple workers until leader lock exists |
| `ELVISH_WEB_ORIGINS` | `api` | Defaults to `$SERVICE_URL_WEB_8080,$SERVICE_URL_ADMIN_8080` after domains are assigned |
| `ELVISH_PUBLIC_BASE_URL` | `api` | Defaults to `$SERVICE_URL_WEB_8080` (user-facing links) |
| `ELVISH_COOKIE_DOMAIN` | `api` | e.g. `.example.com` for split subdomains |

### 5. SMTP (`mail-mta`)

- Compose publishes **25** and **587** on the host (required; Coolify HTTP proxy does not carry SMTP).
- Point MX / submission DNS at this server's public IP.
- Mount shared `elvish_data` for DKIM/relay keys (also used by `worker` for outbound signing).
- One `mail-mta` per host is sufficient; a second MTA on the same machine cannot both bind port 25.

### 6. Health checks

Compose defines Docker healthchecks for every long-running service. Coolify uses them for deploy readiness and restarts; you can mirror the same paths in the Coolify UI for proxy health probes.

| Service | Probe | Notes |
|---------|-------|-------|
| `api` | `GET /api/healthz` on **8765** | Binary `-healthcheck` (distroless-safe) |
| `web` | `GET /healthz` on **8080** | nginx static tier |
| `admin` | `GET /healthz` on **8080** | nginx operator tier |
| `worker` | `-healthcheck` | Pings SQL, Valkey, and Scylla when configured |
| `mail-mta` | `-healthcheck` on internal **8765** | `ELVISH_HTTP_ENABLED=1` for `/api/healthz` only; SMTP stays on 25/587 |
| `docs` (profile) | `GET /healthz` on **8080** | Optional docs site |
| `cockroach` | `cockroach sql -e 'SELECT 1'` | Internal |
| `valkey` | `redis-cli PING` | Internal |
| `scylla` | CQL `system.local` | Long `start_period` (~3 min) |
| `minio` | — | Scratch image; readiness via **`minio-init`** one-shot |
| `scylla-init`, `minio-init` | — | `exclude_from_hc: true`; gate app startup |

`web` and `admin` wait for **`api` healthy** before starting. App tiers wait for **`minio-init` completed** so the blob bucket exists.

After changing healthcheck code, rebuild/publish GHCR images (`ELVISH_IMAGE_TAG`) before redeploying Coolify.

### 7. Scaling `api`

- Increase replica count in Coolify for `api` only.
- Run **one** `worker` replica for outbox and sweepers (MTA tiers do not run the outbox worker).

## Magic variables declared in compose

Coolify generates `SERVICE_*` values when the name appears in a service’s `environment` list. **Each service must declare every magic var it reads**, including cross-service URLs.

| Service | Declared magic vars | Consumed as |
|---------|---------------------|-------------|
| `api` | `SERVICE_URL_*_8765/8080`, `SERVICE_FQDN_*`, `SERVICE_PASSWORD_64_VALKEY`, `SERVICE_USER_MINIO`, `SERVICE_PASSWORD_64_MINIO`, `SERVICE_BASE64_64` | CORS/origins, MFA key, blob/Valkey creds; `ELVISH_MAIL_DOMAIN` defaults to `$SERVICE_FQDN_WEB` |
| `web` | `SERVICE_URL_WEB_8080`, `SERVICE_URL_API_8765`, `SERVICE_URL_ADMIN_8080`, matching `SERVICE_FQDN_*` | `ELVISH_API_BASE`, `ELVISH_ADMIN_ORIGIN` in runtime `api-config.js` |
| `admin` | `SERVICE_URL_ADMIN_8080`, `SERVICE_URL_API_8765`, matching `SERVICE_FQDN_*` | `ELVISH_API_BASE` |
| `docs` (profile) | `SERVICE_URL_DOCS_8080`, `SERVICE_FQDN_DOCS` | Coolify domain for optional docs site |
| `worker`, `mail-mta` | `SERVICE_PASSWORD_64_VALKEY`, `SERVICE_USER_MINIO`, `SERVICE_PASSWORD_64_MINIO`, `SERVICE_BASE64_64`; `mail-mta` also `SERVICE_FQDN_WEB` | Shared secrets + mail domain default; SQL/Scylla/MinIO via internal DNS env |
| `valkey` | `SERVICE_PASSWORD_64_VALKEY` | Generates Valkey password (required by consumers via `:?`) |
| `minio`, `minio-init` | `SERVICE_USER_MINIO`, `SERVICE_PASSWORD_64_MINIO` | Generates MinIO root credentials |
| `scylla` | (none — internal) | Tune via `SCYLLA_SMP`, `SCYLLA_MEMORY` in Coolify UI |
| `scylla-init` | `SCYLLA_HOST`, `SCYLLA_KEYSPACE` | One-shot schema apply after `scylla` healthy |
| `cockroach` | (none — internal) | Tune via `COCKROACH_CACHE`, `COCKROACH_MAX_SQL_MEMORY` |

Prefer **`SERVICE_URL_<SERVICE>_<port>`** over generic `SERVICE_URL_<SERVICE>` (Coolify keeps port-specific vars aligned when domains change).

Compose env syntax follows [`.cursor/rules/docker-compose-coolify.mdc`](../.cursor/rules/docker-compose-coolify.mdc): `${VAR:?}` for required secrets, `${VAR:-default}` for optional values, and `$SERVICE_URL_*` for generated URLs — not hardcoded hostnames in the file.

## Init jobs

`scylla-init` and `minio-init` use `exclude_from_hc: true` so one-shot containers do not fail stack health.

## Related

- [ADR 0017](adr/0017-mandatory-split-deployment.md) — mandatory split
- [runbooks/split-deploy.md](runbooks/split-deploy.md) — ports and scaling
- [Product README](guides/product-readme.md) — env reference
