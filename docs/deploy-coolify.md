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

These use `${VAR:?}` in compose and show a **red border** until set:

| Variable | Example |
|----------|---------|
| `ELVISH_MAIL_DOMAIN` | `mail.example.com` |
| `COOKIE_SECURE` | `1` (production HTTPS) |

Set `ELVISH_COOKIE_DOMAIN` (e.g. `.example.com`) when `web`, `admin`, and `api` use different hostnames so the session cookie is shared.

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
- [Product README](guides/product-readme.md) — env reference
