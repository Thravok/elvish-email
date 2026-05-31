# Deploying ELVish on Coolify (Docker Compose)

Coolify treats [`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml) as the **single source of truth**. Configure domains in the Coolify UI; do not rely on in-repo Traefik labels.

## Services overview

| Service | Public access | Container port | Notes |
|---------|---------------|----------------|-------|
| `api` | Coolify domain | **8765** | Monolith `elvishserver`: marketing, mail UI, `/api/*`, SMTP **25/587**; health: `/api/healthz` |
| `console` | Coolify domain | **8080** | `elvishconsole`: staff auth, `/api/console/*`, support inbox; health: `/healthz` |
| `cockroach`, `valkey`, `scylla`, `minio` | **None** (internal) | — | Reachable only as `cockroach:26257`, `valkey:6379`, `scylla:9042`, `minio:9000`. Do **not** assign Coolify domains or declare `SERVICE_URL_*` on these services. |

Assign domains on **`api`** and **`console`**. SMTP ports **25** and **587** are published on **`api`** only.

## Container images (GHCR)

Coolify **pulls** pre-built images (no on-server Go build in production):

| Role | Image |
|------|--------|
| `api` | `ghcr.io/thravok/elvish-email/api:main` |
| `console` | `ghcr.io/thravok/elvish-email/console:main` |
| `scylla-init` | `ghcr.io/thravok/elvish-email/scylla-init:main` (one-shot) |

Published on every push to `main` ([`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)). Set **`ELVISH_IMAGE_TAG`** in Coolify to pin another tag (e.g. `1.0.0-pre` or `main`).

The compose file also includes a `build:` stanza so forked repos can build locally; production should use GHCR tags.

If packages are private, add a GHCR registry credential in Coolify before deploy.

## One-time Coolify setup

### 1. Create the stack

Import the repo and select **Docker Compose** with `docker-compose.coolify.yaml`.

### 2. Assign domain (HTTP)

In the stack **Domains** UI, assign **`api`**:

| Service | Example domain field |
|---------|----------------------|
| `api` | `https://mail.example.com:8765` |

Include **`:8765`** — the app listens on that port inside the container.

Coolify generates magic variables from the service name:

| Magic variable | Shape | Example use |
|----------------|--------|-------------|
| `SERVICE_URL_API_8765` | Full URL | Default `ELVISH_PUBLIC_BASE_URL` |
| `SERVICE_FQDN_API` | Hostname only | Default `ELVISH_MAIL_DOMAIN` when unset |

### 3. Required environment variables

Compose uses `${VAR:?}` so Coolify shows a **red border** until the value exists. Assign a domain on **`api`** first.

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `COOKIE_SECURE` | `api` | `${COOKIE_SECURE:?1}` | Use `1` in production (HTTPS cookies) |
| `SERVICE_URL_API_8765` | `api` | via domain on **api** | Defaults `ELVISH_PUBLIC_BASE_URL` |
| `SERVICE_FQDN_API` | `api` | via domain on **api** | Defaults `ELVISH_MAIL_DOMAIN` when unset |
| `SERVICE_PASSWORD_64_VALKEY` | `valkey` (+ `api`) | auto-generated | Valkey password |
| `SERVICE_USER_MINIO` / `SERVICE_PASSWORD_64_MINIO` | `minio` (+ `api`) | auto-generated | Blob credentials; `minio-init` creates the bucket |
| `SERVICE_BASE64_64` | `api` | auto-generated | MFA encryption key material |

**Internal data stores** (Docker DNS defaults):

| Variable | Default | Used by |
|----------|---------|---------|
| `COCKROACH_DSN` | `postgres://root@cockroach:26257/defaultdb?sslmode=disable` | `api` |
| `VALKEY_ADDR` | `valkey:6379` | `api` |
| `SCYLLA_HOSTS` | `scylla:9042` | `api`; **`scylla-init`** applies schema |
| `SCYLLA_KEYSPACE` | `elvish_mail` | same + `scylla-init` |
| `BLOB_S3_ENDPOINT` | `http://minio:9000` | `api`; **`minio-init`** creates bucket |

### 4. SMTP

- Compose publishes **25** and **587** on **`api`** (Coolify HTTP proxy does not carry SMTP).
- Point MX / submission DNS at this server's public IP.
- Mount shared `elvish_data` for DKIM/relay keys (or set `ELVISH_AUTO_GEN_DKIM_KEY=1` for dev only).

### 5. Health checks

| Service | Probe | Notes |
|---------|-------|-------|
| `api` | `GET /api/healthz` on **8765** | Binary `-healthcheck` (distroless-safe) |
| `cockroach` | `cockroach sql -e 'SELECT 1'` | Internal |
| `valkey` | `redis-cli PING` | Internal |
| `scylla` | CQL `system.local` | Long `start_period` (~3 min) |
| `minio` | `GET /minio/health/live` on **9000** | Internal |
| `scylla-init`, `minio-init` | — | `exclude_from_hc: true`; gate app startup |

`api` waits for **`minio-init` completed** so the blob bucket exists.

### 6. Scaling

One **`api`** replica is recommended until an outbox leader lock exists for N>1 horizontal scale.

## Init jobs

`scylla-init` and `minio-init` use `exclude_from_hc: true` so one-shot containers do not fail stack health. Coolify strips that field before Docker runs it; validate locally with `make compose-coolify-config`.

## Related

- [Product README](../README.md) — env reference
- [ADR 0014](adr/0014-inbound-mail-authentication.md) — planned inbound SPF/DKIM/DMARC
- [ADR 0016](adr/0016-operator-settings-in-sql.md) — operator settings in SQL

Split-origin / multi-binary deployment work lives on branch `archive/split-monorepo` (tag `archive/pre-1.0.0-pre-revert`) for future use.
