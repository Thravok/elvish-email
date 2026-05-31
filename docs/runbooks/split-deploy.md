# Split deployment runbook

Production defaults to **single-origin**: one Coolify domain on **`api`** serves marketing, mail UI, and `/api/*`. Mail transport still runs as separate Go processes (`elvishmta`, `elvishworker`).

Optional **split-origin** nginx tiers (`web`, `admin`) are available via compose profile `split-origin` when you are ready to separate browser origins.

See [ADR 0018](../adr/0018-monorepo-split-origin-deploy.md) (split-origin is optional, not the default).

## Local development

### Default (single origin)

```bash
make db-up
brew install overmind   # optional
make dev                # Procfile: api, mta, worker
```

- App: http://127.0.0.1:8765 (`/`, `/mail`, `/login`, `/api/*`)

Without Overmind: `bash scripts/dev-split.sh`.

### Docker full stack

```bash
docker compose --profile full up
```

The `api` container serves static mail UI (`ELVISH_SERVE_STATIC=1`).

### Split-origin (optional)

```bash
# Local compose
docker compose --profile full --profile split-origin up

# Coolify: set COMPOSE_PROFILES=split-origin before assigning web/admin domains
```

Set on **`api`** when split:

| Env | Example |
|-----|---------|
| `ELVISH_SERVE_STATIC` | `0` |
| `ELVISH_WEB_ORIGIN` | `https://mail.example.com` |
| `ELVISH_ADMIN_ORIGIN` | `https://admin.example.com` |

## Production (Coolify)

Deploy **`api`**, **`mail-mta`**, **`worker`**, plus internal data stores. Assign **one domain** on `api` (port **8765**).

| Env (api) | Example |
|-----------|---------|
| `ELVISH_SERVE_STATIC` | `1` (default in compose) |
| `ELVISH_PUBLIC_BASE_URL` | `https://mail.example.com:8765` (from `SERVICE_URL_API_8765`) |
| `ELVISH_MAIL_DOMAIN` | Your mail domain (defaults from `SERVICE_FQDN_API`) |

**Do not** set `ELVISH_BACKGROUND_JOBS` on API; worker owns outbox and sweepers.

## Scaling

| Tier | Scale | Notes |
|------|-------|-------|
| `api` | N | Stateless; one instance runs migrations |
| `worker` | 1 | Leader lock before N>1 |
| `mail-mta` | 1 per host | Host :25 / :587; inbound only (outbox on `worker`) |
| `web` / `admin` | N | Optional profile; static nginx only |
