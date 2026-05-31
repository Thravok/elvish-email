# ELVish

ELVish is an open-source platform for **end-to-end encrypted mail**, operator tooling, and a public marketing site. Production defaults to a **single-origin** `elvishapi` process (marketing, mail UI, and `/api/*` on one domain); mail transport runs as separate Go roles (`elvishmta`, `elvishworker`).

**License:** [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) ([LICENSE](LICENSE))

**Community:** [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)

When you publish your own deployment, point the site footer **Source** link at your public clone by editing `services/api/content/home.json` (`footer.pages`, entry with `"label": "Source"`) instead of the default `"#"`.

---

## Architecture

Five deployables share one Go module (`elvish`) and talk to CockroachDB/Postgres, Valkey, ScyllaDB, and an S3-compatible blob store for mail.

| Tier | Binary / image | Role | Local port |
|------|----------------|------|------------|
| **api** | `elvishapi` | JSON API, SSR marketing, mail/auth UI | `:8765` |
| **mail-mta** | `elvishmta` | SMTP ingest (MX + submission) | `:2525` / `:2587` |
| **worker** | `elvishworker` | Outbox delivery, sweepers | (no HTTP) |

Optional split-origin nginx tiers (`web`, `admin`) exist for future use — see [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md).

Backend roles **refuse to start** until **CockroachDB/Postgres** (`COCKROACH_DSN`) and **Valkey** are configured. Set `ELVISH_ALLOW_EMPTY_DB=1` only for static-only API demos without auth.

See [docs/architecture.md](docs/architecture.md), [CODEBASES.md](CODEBASES.md), and [ADR 0018](docs/adr/0018-monorepo-split-origin-deploy.md).

---

## Quick start

**Prerequisites:** Go ([go.mod](go.mod)), Docker, Node.js (for `make static-js`). Optional: [Overmind](https://github.com/DarthSim/overmind) for `make dev`.

```bash
make db-up   # CockroachDB, Valkey, Scylla, MinIO (+ schema init)
make dev     # api + mta + worker (Overmind or scripts/dev-split.sh)
```

| URL | Purpose |
|-----|---------|
| http://127.0.0.1:8765/ | Home (SSR marketing) |
| http://127.0.0.1:8765/mail | Mail UI |
| http://127.0.0.1:8765/login | Sign in |
| http://127.0.0.1:8765/api/docs | OpenAPI Redoc |
| http://127.0.0.1:8765/feed.xml | RSS (also `/atom.xml`, `/feed.json`) |

`make dev` auto-runs `make db-up` and exports local DSN/Valkey/mail backend defaults. Useful overrides:

| Variable | Effect |
|----------|--------|
| `SKIP_AUTO_DB_UP=1` | Do not start Docker backends automatically |
| `SKIP_MAIL_BACKENDS=1` | Skip Scylla/S3 defaults (mail APIs return 503 until configured) |

Single roles: `make dev-api-once`, `make dev-mta-once`, `make dev-worker-once`. Full container stack: `make compose-up`. Details: [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md).

**Local databases** (`make db-up`): CockroachDB `:26257`, Valkey `:6379`, Scylla `:9042`, MinIO S3 `:8333` (console `:9001`). First Scylla boot can take 1–2 minutes. Stop with `make db-down`; wipe volumes with `make db-clean`. Health check: `make db-health`.

---

## Build and test

```bash
make build          # static-js + bin/elvishapi, bin/elvishmta, bin/elvishworker
make check          # fmt, vet, lint, static-js, openapi-check, tests, vuln
make test-e2e       # Playwright admin E2E (see e2e/README.md)
make openapi        # regenerate libs/go/apidoc/openapi.yaml
```

| Command | Purpose |
|---------|---------|
| `make static-js` | Bundle mail/admin UI → `apps/web/dist/`, `apps/admin/dist/` |
| `make dev-watch` | Rebuild on file changes (requires [fswatch](https://emcrisostomo.github.io/fswatch/)) |
| `make migrate` | Import disk blog posts into SQL |
| `make docs-serve` | MkDocs site from `docs/` |

More commands: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Configuration

**Product settings** (public URL, mail domain, CORS, registration, DKIM selector, captcha, telemetry) live in the **admin panel** at `/mail?view=admin` — see [ADR 0016](docs/adr/0016-operator-settings-in-sql.md). Legacy `ELVISH_*` product env vars are imported once on first boot when the database row is empty, then ignored.

### Bootstrap (required for production)

| Variable | Purpose |
|----------|---------|
| `COCKROACH_DSN` | Postgres or Cockroach connection string |
| `VALKEY_ADDR` | Valkey/Redis `host:port` |
| `VALKEY_PASSWORD` | Optional |
| `VALKEY_DB` | Numeric DB index (default `0`) |
| `COOKIE_SECURE` | `1` or `true` for `Secure` session cookies |
| `ELVISH_COOKIE_DOMAIN` | e.g. `.example.com` for split-origin session cookies |
| `ELVISH_WEB_ORIGIN` / `ELVISH_ADMIN_ORIGIN` | Browser tier URLs (api redirects/CORS) |
| `ELVISH_COMPONENT` | Optional cross-check (`api` / `mta` / `worker`); [ADR 0017](docs/adr/0017-mandatory-split-deployment.md) |
| `ELVISH_BACKGROUND_JOBS` | **Do not set on API** — sweepers run on `worker` only |
| `ELVISH_ALLOW_EMPTY_DB` | `1` for static-only demos without DB |

### Secrets and mail backends

| Variable | Purpose |
|----------|---------|
| `ELVISH_MFA_ENCRYPTION_KEY` | AES key for server-readable MFA secrets |
| `ELVISH_AUTO_GEN_MFA_KEY` | Dev: auto-generate MFA key at `<root>/data/mfa.key` |
| `ELVISH_DKIM_KEY_PATH` | DKIM RSA PEM (selector/domain in admin) |
| `ELVISH_RELAY_KEY_PATH` | Mode C relay OpenPGP key |
| `SCYLLA_*` / `BLOB_S3_*` | Mail projections and ciphertext blobs — see [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md) |
| `ELVISH_SMTP_*` | MTA listen addresses and TLS |

Local dev sets `ELVISH_AUTO_GEN_MFA_KEY=1` by default. With a non-empty `COCKROACH_DSN`, `elvishapi` applies embedded SQL migrations (goose) on startup.

**Auth:** `POST /api/auth/register`, `POST /api/auth/login` (HTTP-only `elvish_session` cookie), or `/register` / `/login` in the browser. Admin bootstrap: `GET /api/bootstrap.json`.

---

## E2EE mail

Mail uses a **four-store** model (Cockroach metadata, Scylla projections, S3 ciphertext, Valkey sessions). The compose UI supports three send modes:

| Mode | Summary | ADR |
|------|---------|-----|
| **A — PGP direct** | Browser encrypts to recipient's published key | [0005](docs/adr/0005-account-key-hierarchy.md) |
| **B — Protected link** | Password-wrapped ciphertext; unlock at `/m/{token}` | [0009](docs/adr/0009-protected-link-mode.md) |
| **C — Plaintext relay** | Wrapped to operator relay key; worker signs with DKIM and sends | [0010](docs/adr/0010-plaintext-relay-mode.md) |

Spec and threat model: [docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md). SMTP stack: [ADR 0006](docs/adr/0006-own-smtp-stack.md).

---

## Deploy

Production runs all five tiers on split origins. Coolify layout: [docs/deploy-coolify.md](docs/deploy-coolify.md). Runbook: [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md).

Images publish to GHCR on push to `main` (`ghcr.io/thravok/elvish-email/{api,web,admin,worker,mta}:main`). Pin with `ELVISH_IMAGE_TAG` in Coolify.

Operator routes under `/api/admin/*` require an admin session when Valkey is configured.

---

## Content

| Path | Purpose |
|------|---------|
| [services/api/content/home.json](services/api/content/home.json) | Site config, nav, cache bust (`hash_short`) |
| [services/api/content/blog/](services/api/content/blog/) | Markdown posts (Goldmark); defaults when SQL is empty |
| [services/api/content/uptime.json](services/api/content/uptime.json) | Optional uptime probes |

Live posts in SQL use **OpenPGP** detached signatures. Legacy disk posts: `make blog-sign` / `make blog-verify` (`elvishsign`).

---

## Documentation

| Topic | Doc |
|-------|-----|
| Doc index | [docs/README.md](docs/README.md) |
| Repo layout & CI | [docs/repo-layout.md](docs/repo-layout.md) |
| ADRs | [docs/adr/README.md](docs/adr/README.md) |
| Client parity (web / iOS / Android) | [docs/client-parity-roadmap.md](docs/client-parity-roadmap.md) |
| Agent / automation orientation | [AGENTS.md](AGENTS.md) |

Development uses **GitLab** for source hosting today; vulnerability reporting is in [SECURITY.md](SECURITY.md).
