# Documentation index

| Topic | Doc |
|-------|-----|
| **Where code lives** | [CODEBASES.md](../CODEBASES.md), [repo-layout.md](repo-layout.md) |
| **Split deploy** | [runbooks/split-deploy.md](runbooks/split-deploy.md) |
| **E2EE mail** | [e2ee-mail-spec.md](e2ee-mail-spec.md) |
| **ADRs** | [adr/README.md](adr/README.md) (0018 = monorepo + split-origin) |
| **Architecture** | [architecture.md](architecture.md) |
| **Contributing** | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

## Code map (post-rewrite)

- **Go module:** `elvish` — shared libraries under `libs/go/`, binaries under `services/*/cmd/`
- **Browser:** `apps/web/`, `apps/admin/`, `packages/elvish-ui/`, `packages/elvish-client/`
- **SQL migrations:** `libs/go/db/migrations/` (api only)
- **OpenAPI:** `libs/go/apidoc/openapi.yaml` (`make openapi`)
