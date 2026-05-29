# ELVish codebases map

| I need to… | Go here |
|------------|---------|
| Change JSON API / SSR routing | [`libs/go/httpserver/`](libs/go/httpserver/) |
| Change SMTP ingest | [`services/mta/`](services/mta/) |
| Change outbox / sweepers | [`services/worker/`](services/worker/) |
| Change mail UI | [`apps/web/mail/`](apps/web/mail/) |
| Change operator UI | [`apps/admin/src/`](apps/admin/src/) |
| Change shared button/modal/tokens | [`packages/elvish-ui/`](packages/elvish-ui/) |
| Change API client helpers | [`packages/elvish-client/`](packages/elvish-client/) |
| Change SQL schema | [`libs/go/db/migrations/`](libs/go/db/migrations/) (run on api only) |
| Regenerate OpenAPI | `make openapi` → [`tools/apiroutes/`](tools/apiroutes/) |
| Local dev (all roles) | `make dev` → [`Procfile`](Procfile) |

## Deployables

| Service | Codebase | Image |
|---------|----------|-------|
| api | [`services/api/`](services/api/) | `services/api/Dockerfile` |
| web | [`apps/web/`](apps/web/) | `apps/web/Dockerfile` |
| admin | [`apps/admin/`](apps/admin/) | `apps/admin/Dockerfile` |
| mail-mta | [`services/mta/`](services/mta/) | `services/mta/Dockerfile` |
| worker | [`services/worker/`](services/worker/) | `services/worker/Dockerfile` |
