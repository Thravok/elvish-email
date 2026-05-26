# Elvish E2E (Playwright)

Browser and API smoke tests for the **mail-embedded operator panel** (`/mail?view=admin`) and admin JSON routes.

## Prerequisites

1. **CockroachDB + Valkey** running (e.g. `make db-up` from repo root, or let `make dev` start the local Docker stack automatically).
2. **`elvishapi`** running with the same env (e.g. `make dev` or `make dev-api-once` in another terminal on `:8765`).
3. Optional **admin credentials** for API tests:
   - `E2E_ADMIN_USERNAME` — must match an existing user’s login username (local part of their canonical `username@mail-domain` address) with `is_admin = true`.
   - `E2E_ADMIN_PASSWORD` — that user’s password.

If `E2E_ADMIN_*` are unset, the anonymous shell test still runs; the “admin uptime API succeeds” test is skipped.

## Run

From repo root:

```bash
make test-e2e
```

Or manually:

```bash
cd e2e
npm ci
npx playwright install
BASE_URL=http://127.0.0.1:8765 E2E_ADMIN_USERNAME=admin E2E_ADMIN_PASSWORD='…' npm test
```

## CI

Start Docker (`make db-up`), run migrations via `go run ./cmd/elvishapi -root .` (goose on startup) or existing integration flow, seed an admin user, start **`elvishapi`**, then `make test-e2e` with `E2E_ADMIN_*` from CI secrets.
