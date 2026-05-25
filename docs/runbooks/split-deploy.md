# Split deployment runbook

ELVish runs as **three Go processes** plus the browser tier on **`elvishapi`**:

| Tier | Binary | Default port (local) |
|------|--------|----------------------|
| API + browser | `elvishapi` | 8765 |
| Mail MTA | `elvishmta` | SMTP 2525→25, 2587→587 |
| Worker | `elvishworker` | (no HTTP) |

## Local development

### All roles at once

```bash
make db-up          # once
brew install overmind   # recommended
make dev            # Procfile: api, mta, worker
```

Without Overmind: `bash scripts/dev-split.sh` (same roles in background).

- App: http://127.0.0.1:8765 (static, SSR, `/api/*`)
- SMTP: localhost:2525 (MX), localhost:2587 (submission)

### Single role

```bash
make dev-api-once
make dev-mta-once
make dev-worker-once
```

### Docker full stack

```bash
make compose-up
# elvishapi on :8765; mta + worker in compose profile full
```

## Production (Coolify)

See [deploy-coolify.md](../deploy-coolify.md). Required services:

- `api` — `elvishapi`, domain `https://app.example.com:8765` (one origin for UI + API)
- `mail-mta` — `elvishmta`, host ports 25/587
- **`worker`** — `elvishworker`, no public HTTP

`ELVISH_COOKIE_DOMAIN` is optional for single-origin deploys.

**Do not** set `ELVISH_BACKGROUND_JOBS` on API; sweepers and outbox delivery run on **worker** only.

## Scaling

| Tier | Scale | Notes |
|------|-------|-------|
| `api` | N | Stateless HTTP; only **one** runs migrations on startup |
| `worker` | 1 (for now) | Outbox + retention; add leader lock before N>1 |
| `mail-mta` | 1+ per MX IP | Two instances cannot bind host :25 on one machine |

## Migrations and ops

- SQL goose migrations: **`elvishapi` only**
- Disk blog import: `go run ./cmd/elvishapi -root . -migrate`
- Health: `GET /api/healthz` on API (or MTA with `ELVISH_HTTP_ENABLED=1`)

## Related

- [ADR 0017](../adr/0017-mandatory-split-deployment.md)
- [repo-layout.md](../repo-layout.md)
