# Deploying ELVish on Coolify (Docker Compose)

Coolify treats [`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml) as the **single source of truth**. Configure domains in the Coolify UI; do not rely on in-repo Traefik labels.

## Services overview

| Service | Public access | Container port | Notes |
|---------|---------------|------------------|--------|
| `public` | Coolify domain | **80** | Static assets + SSR proxy to `api` (service name drives `SERVICE_*_PUBLIC` magic vars) |
| `api` | Coolify domain | **8765** | JSON API, health: `/api/healthz` |
| `mail-mta` | **Host ports** `25`, `587` | 25 / 587 | No HTTP domain; MX DNS → server IP |
| `cockroach`, `valkey`, `scylla`, `minio` | Optional admin domains | 8080 / — / 9042 / 9001 | Internal only by default |

## One-time Coolify setup

### 1. Create the stack

Import the repo and select **Docker Compose** with `docker-compose.coolify.yaml`.

### 2. Assign domains (HTTP services)

In the stack **Domains** UI:

| Service | Example domain field | Why |
|---------|----------------------|-----|
| `public` | `https://app.example.com` | Listens on port 80 in-container |
| `api` | `https://api.example.com:8765` | Listens on port **8765** (include `:8765` in the domain field) |

Coolify generates **magic variables from the compose service name** (not from `ELVISH_*` names):

| Magic variable | Shape | Example use in this stack |
|----------------|--------|---------------------------|
| `SERVICE_URL_PUBLIC` | Full URL (`https://…`) | Default `ELVISH_WEB_ORIGINS` on `api` |
| `SERVICE_FQDN_PUBLIC` | Hostname only | DNS / debugging; not enough alone for browser URLs |
| `SERVICE_URL_API_8765` | Full URL | Default `ELVISH_PUBLIC_BASE_URL`, `ELVISH_API_PUBLIC_URL` |
| `SERVICE_FQDN_API` | Hostname only | Same caveat — app needs `SERVICE_URL_*` for OIDC and fetch bases |

There is **no** built-in `SERVICE_FQDN_PUBLIC` unless the service is literally named `public` (we use that name for the browser tier). **`ELVISH_PUBLIC_BASE_URL` is the API’s canonical URL**, not the `public` service hostname — keep the `ELVISH_*` name in application code and default it from `$SERVICE_URL_API_8765` in compose.

Optional admin UIs (only if you want them exposed):

| Service | Example |
|---------|---------|
| `cockroach` | `https://db.example.com:8080` → `SERVICE_URL_COCKROACH_8080` |
| `minio` | `https://minio.example.com:9001` → `SERVICE_URL_MINIO_9001` |

### 3. Required environment variables (Coolify UI)

These use `${VAR:?}` in compose and show a **red border** until set:

| Variable | Example |
|----------|---------|
| `ELVISH_MAIL_DOMAIN` | `mail.example.com` |
| `ELVISH_COOKIE_DOMAIN` | `.example.com` (leading dot for split-origin cookies) |

### 4. Recommended overrides

| Variable | Where | Value |
|----------|-------|--------|
| `ELVISH_BACKGROUND_JOBS` | **One** `api` replica only | `1` (default in compose is `0` so scaled replicas stay safe) |
| `ELVISH_WEB_ORIGINS` | `api` | Usually leave default `$SERVICE_URL_PUBLIC` after `public` domain is assigned |
| `ELVISH_API_PUBLIC_URL` | `public` | Usually leave default `$SERVICE_URL_API_8765` after `api` domain is assigned |

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
- Set `ELVISH_BACKGROUND_JOBS=1` on **exactly one** replica (or a dedicated “jobs” instance).
- `mail-mta` (and optional second MTA) run outbound workers; `LeasePendingOutbox` is safe across workers.

## Magic variables declared in compose

Declared on `api` (reused stack-wide per Coolify rules):

- `SERVICE_URL_API_8765`, `SERVICE_FQDN_API`, `SERVICE_URL_PUBLIC`, `SERVICE_FQDN_PUBLIC`
- `SERVICE_PASSWORD_64_VALKEY`, `SERVICE_USER_MINIO`, `SERVICE_PASSWORD_64_MINIO`
- `SERVICE_BASE64_64` (MFA key seed material)

## Init jobs

`scylla-init` and `minio-init` use `exclude_from_hc: true` so one-shot containers do not fail stack health.

## Related

- [ADR 0015](adr/0015-multi-service-deployment.md) — architecture
- [README.md](../README.md) — env reference
