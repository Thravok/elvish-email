# Split deployment runbook

ELVish runs as **three Go processes** plus **two browser tiers** in production (split origin):

| Tier | Artifact | Default port (local) |
|------|----------|----------------------|
| API + SSR | `elvishapi` | 8765 |
| Web (mail/auth) | nginx `apps/web` | 8081 |
| Admin (operator) | nginx `apps/admin` | 8082 |
| Mail MTA | `elvishmta` | SMTP 2525→25, 2587→587 |
| Worker | `elvishworker` | (no HTTP) |

See [ADR 0018](../adr/0018-monorepo-split-origin-deploy.md).

## Local development

### All roles at once

```bash
make db-up
brew install overmind
make dev            # Procfile: api, web, admin, mta, worker
```

- API: http://127.0.0.1:8765 (`/api/*`, SSR marketing)
- Web: http://127.0.0.1:8081 (mail UI static)
- Admin: http://127.0.0.1:8082 (operator console)
- Set `ELVISH_WEB_ORIGIN=http://127.0.0.1:8081` and `ELVISH_ADMIN_ORIGIN=http://127.0.0.1:8082` on api when testing redirects.

Without Overmind: `bash scripts/dev-split.sh`.

### Docker full stack

```bash
docker compose --profile full up
```

`api` has `ELVISH_SERVE_STATIC=0`; `web` and `admin` services serve bundles.

## Production (Coolify)

Deploy **api**, **web**, **admin**, **mail-mta**, **worker**. Set `ELVISH_COOKIE_DOMAIN=.example.com` for shared session cookies across subdomains.

| Env (api) | Example |
|-----------|---------|
| `ELVISH_SERVE_STATIC` | `0` |
| `ELVISH_WEB_ORIGIN` | `https://mail.example.com` |
| `ELVISH_ADMIN_ORIGIN` | `https://admin.example.com` |

**Do not** set `ELVISH_BACKGROUND_JOBS` on API; worker owns outbox and sweepers.

## Scaling

| Tier | Scale | Notes |
|------|-------|-------|
| `api` | N | Stateless; one instance runs migrations |
| `worker` | 1 | Leader lock before N>1 |
| `mail-mta` | 1 per host | Host :25 / :587; inbound only (outbox on `worker`) |
| `web` / `admin` | N | Static nginx only |
