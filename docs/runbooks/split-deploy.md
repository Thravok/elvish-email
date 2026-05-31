# Split deployment runbook

Production defaults to a **monolith**: one **`api`** container runs HTTP, SMTP, outbox delivery, and sweepers (`ELVISH_MONOLITH=1`). One Coolify domain on `api` (port **8765**); SMTP on host ports **25** and **587**.

Optional compose profiles exist when you want to split later:

| Profile | Enables |
|---------|---------|
| `split-origin` | Separate nginx `web` / `admin` containers |
| `split-roles` | Separate `mail-mta` and `worker` (set `ELVISH_MONOLITH=0` on `api`) |

See [ADR 0018](../adr/0018-monorepo-split-origin-deploy.md).

## Local development

```bash
make db-up
make dev                # monolith api on :8765, SMTP :2525/:2587
```

Without Overmind: `bash scripts/dev-split.sh`.

### Docker full stack

```bash
docker compose --profile full up
```

One `api` service — no separate mta/worker containers.

## Production (Coolify)

Deploy **`api`** plus internal data stores. Assign **one domain** on `api` (`:8765`). Publish SMTP on the same service (ports **25** / **587**).

| Env (api) | Default |
|-----------|---------|
| `ELVISH_MONOLITH` | `1` |
| `ELVISH_SERVE_STATIC` | `1` |
| `ELVISH_SMTP_ADDR` | `:25` |
| `ELVISH_SMTP_SUBMISSION_ADDR` | `:587` |
| `ELVISH_PUBLIC_BASE_URL` | from `SERVICE_URL_API_8765` |

## Scaling (split profile only)

When using `split-roles`, scale `api` without monolith, plus dedicated `worker` and `mail-mta` as documented in [ADR 0017](../adr/0017-mandatory-split-deployment.md).
