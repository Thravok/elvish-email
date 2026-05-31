# Deploying ELVish on Coolify (Docker Compose)

Coolify treats [`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml) as the **single source of truth**. Configure domains in the Coolify UI; do not rely on in-repo Traefik labels.

## Services overview

| Service | Public access | Container port | Notes |
|---------|---------------|------------------|--------|
| `api` | Coolify domain | **8765** | Single-origin app: marketing, mail UI, `/api/*` (`ELVISH_SERVE_STATIC=1`); health: `/api/healthz` |
| `web` | Coolify domain (profile `split-origin` only) | **8080** | Optional mail/auth nginx |
| `admin` | Coolify domain (profile `split-origin` only) | **8080** | Optional operator nginx |
| `docs` | Coolify domain (profile `docs` only) | **8080** | MkDocs static site (`ghcr.io/thravok/elvish-email/docs:main`); optional |
| `mail-mta` | **Host ports** `25`, `587` | 25 / 587 | No HTTP domain; MX DNS → server IP |
| `worker` | Internal only | — | `elvishworker`: outbox + sweepers; scale to **one** replica |
| `cockroach`, `valkey`, `scylla`, `minio` | **None** (internal) | — | Reachable only as `cockroach:26257`, `valkey:6379`, `scylla:9042`, `minio:9000`. Do **not** assign Coolify domains or declare `SERVICE_URL_*` on these services. |

**Default:** assign one domain on **`api`** only. Enable `COMPOSE_PROFILES=split-origin` before assigning domains on `web` / `admin`.

## Container images (GHCR)

Coolify **pulls** pre-built role images (no on-server Go/nginx builds for app tiers):

| Role | Image |
|------|--------|
| `api` | `ghcr.io/thravok/elvish-email/api:main` |
| `web` | `ghcr.io/thravok/elvish-email/web:main` |
| `admin` | `ghcr.io/thravok/elvish-email/admin:main` |
| `worker` | `ghcr.io/thravok/elvish-email/worker:main` |
| `mail-mta` | `ghcr.io/thravok/elvish-email/mta:main` |
| `docs` | `ghcr.io/thravok/elvish-email/docs:main` (profile `docs`) |
| `scylla-init` | `ghcr.io/thravok/elvish-email/scylla-init:main` (one-shot) |

Published on every push to `main` ([`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)). Set **`ELVISH_IMAGE_TAG`** in Coolify to pin another tag (e.g. `1.0.0-pre` or `main`). The **`api`** image bundles prebuilt mail UI assets — no separate `web` container required for single-origin deploy.

`web` and `admin` images remain available for the optional `split-origin` profile.

`docs` is **off by default** (compose profile `docs`). Image: `ghcr.io/thravok/elvish-email/docs:main` after CI publishes it. Enable with `COMPOSE_PROFILES=docs` in Coolify **before** assigning a docs domain; otherwise the container stays **Exited**.

If packages are private, add a GHCR registry credential in Coolify before deploy.

## One-time Coolify setup

### 1. Create the stack

Import the repo and select **Docker Compose** with `docker-compose.coolify.yaml`. Coolify only needs the compose file from git; all ELVish services pull pre-built GHCR images.

### 2. Assign domains (HTTP services)

In the stack **Domains** UI:

| Service | Example domain field | Why |
|---------|----------------------|-----|
| `api` | `https://mail.example.com:8765` | Full app (home, mail, API); include `:8765` |
| `web` | `https://mail.example.com:8080` | Optional; requires `COMPOSE_PROFILES=split-origin` |
| `admin` | `https://admin.example.com:8080` | Optional; requires `COMPOSE_PROFILES=split-origin` |
| `docs` | `https://docs.example.com:8080` | Optional internal docs site; include `:8080` in the domain field |

Coolify generates **magic variables from the compose service name** (hyphen + port when not 80, e.g. `SERVICE_URL_API_8765`):

| Magic variable | Shape | Example use in this stack |
|----------------|--------|---------------------------|
| `SERVICE_URL_API_8765` | Full URL | Default `ELVISH_PUBLIC_BASE_URL` on `api` |
| `SERVICE_FQDN_API` | Hostname only | Default `ELVISH_MAIL_DOMAIN` when unset |

### 3. Required environment variables (Coolify UI)

Compose uses `${VAR:?}` so Coolify shows a **red border** until the value exists. Assign a domain on **`api`** first — that populates `SERVICE_URL_API_8765` and `SERVICE_FQDN_API`.

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `COOKIE_SECURE` | `api` | `${COOKIE_SECURE:?1}` | Use `1` in production (HTTPS cookies) |
| `SERVICE_URL_API_8765` | `api` | via domain on **api** | Defaults `ELVISH_PUBLIC_BASE_URL` |
| `SERVICE_FQDN_API` | `api`, `mail-mta` | via domain on **api** | Defaults `ELVISH_MAIL_DOMAIN` when unset |
| `SERVICE_PASSWORD_64_VALKEY` | `valkey` (+ consumers) | auto-generated | Declared on `valkey`; required on `api` / `worker` / `mail-mta` via `:?` |
| `SERVICE_USER_MINIO` / `SERVICE_PASSWORD_64_MINIO` | `minio` (+ consumers) | auto-generated | Blob credentials; `minio-init` creates the bucket |
| `SERVICE_BASE64_64` | `api` (+ worker/mta) | auto-generated | MFA encryption key material |

**Recommended (not `:?` in compose):** `ELVISH_COOKIE_DOMAIN` only when using the optional `split-origin` profile across subdomains.

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
| `minio` | `GET /minio/health/live` on **9000** | Internal; curl/wget fallback in compose |
| `scylla-init`, `minio-init` | — | `exclude_from_hc: true`; gate app startup |

`web` and `admin` start independently of `api` (static nginx + runtime `api-config.js`). App tiers wait for **`minio-init` completed** so the blob bucket exists.

### Troubleshooting deploy stuck on `web` / `admin`

Symptoms: `api` and `worker` are **healthy**, but `web` / `admin` show **Starting (unknown)**.

1. **Redeploy after GHCR publish** — web/admin entrypoint scripts must be in the image (`web`/`admin` tags newer than the bind-mount-only era).
2. **Confirm domains** — assign `https://web.example.com:8080`, `https://admin.example.com:8080`, and `https://api.example.com:8765` so `SERVICE_URL_*` magic vars populate `ELVISH_API_BASE`.
3. **Check container logs** — `nginx -t` runs at start; a bad config or missing `shared/` dir exits before `/healthz` is reachable.
4. **Do not assign an HTTP domain to `mail-mta`** — SMTP uses host ports 25/587 only; an accidental HTTPS domain can confuse Coolify health for that service.
5. **`docs` Exited** — expected unless `COMPOSE_PROFILES=docs` is set; remove the docs domain or enable the profile.

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

`scylla-init` and `minio-init` use `exclude_from_hc: true` so one-shot containers do not fail stack health. Coolify strips that field before Docker runs it; validate the file locally with `make compose-coolify-config` (strips Coolify-only keys and runs `docker compose config`).

`minio` exposes an internal healthcheck on `/minio/health/live`; app tiers wait for `minio` **healthy** (not merely started) before boot.

## Related

- [ADR 0017](adr/0017-mandatory-split-deployment.md) — mandatory split
- [runbooks/split-deploy.md](runbooks/split-deploy.md) — ports and scaling
- [Product README](guides/product-readme.md) — env reference
