# ELVISH (live site + admin)

ELVish is **open source** under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) (see [LICENSE](LICENSE)). Contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md). Community: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security reports: [SECURITY.md](SECURITY.md).

When you publish your own deployment, point the site footer **Source** link at your public clone by editing `services/api/content/home.json` (`footer.pages`, entry with `"label": "Source"`) instead of the default `"#"`.

## Documentation

- **Source hosting** — development uses **GitLab** (private today; public when you choose). Vulnerability reporting is described in [SECURITY.md](SECURITY.md).
- **[docs/README.md](docs/README.md)** — index of design docs, ADRs, and specs
- **HTTP API catalog** — OpenAPI 3 at `/api/openapi.yaml` and Redoc UI at `/api/docs` (regenerate with `make openapi`; see [docs/openapi/supplemental.yaml](docs/openapi/supplemental.yaml))
- **[docs/architecture.md](docs/architecture.md)** — system overview and diagram
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — dev commands, conventions, code map
- **[AGENTS.md](AGENTS.md)** — short orientation for automation / AI assistants

ELVish runs as **`elvishapi`** (HTTP API + SSR marketing), **`elvishmta`** (SMTP), **`elvishworker`** (outbox + sweepers), plus browser tiers **`apps/web`** (mail) and **`apps/admin`** (operator). See [CODEBASES.md](CODEBASES.md) and [ADR 0018](docs/adr/0018-monorepo-split-origin-deploy.md). **Defaults** come from `services/api/content/` when SQL has no posts yet. Backend roles **refuse to start** until **CockroachDB/Postgres** (`COCKROACH_DSN`) and **Valkey** are configured (see `ELVISH_ALLOW_EMPTY_DB` for rare static-only API demos).

**Feeds** (at site root): RSS `/feed.xml`, Atom `/atom.xml`, [JSON Feed 1.1](https://jsonfeed.org/version/1.1) `/feed.json`. `<link rel="alternate">` is emitted on home, log index, and post pages.

## Run locally

```bash
make db-up   # once: CockroachDB + Valkey + Scylla + MinIO
make dev     # api :8765 + web :8081 + admin :8082 + mta + worker (Overmind or dev-split.sh)
```

See [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md). Single roles: **`make dev-api-once`**, **`make dev-mta-once`**, **`make dev-worker-once`**. Docker all-in-one: **`make compose-up`**.

For site-only work without Scylla/S3, use **`SKIP_MAIL_BACKENDS=1`** (mail APIs return 503 until backends are configured).

Open `http://127.0.0.1:8765/` (API/SSR), `http://127.0.0.1:8081/` (mail), `http://127.0.0.1:8082/` (operator; admin session required).

**Auth pages (browser):** `/register` and `/login` — same API as the modals; after success, admins typically open `/mail?view=admin`, others go to `/mail` or `/`.

### Local databases (Docker Compose)

From the repo root:

```bash
make db-up
# same as: docker compose up -d cockroach valkey scylla minio
# then: docker compose run --rm scylla-init
# then: docker compose run --rm minio-init
```

This starts **CockroachDB** on `127.0.0.1:26257`, **Valkey** on `127.0.0.1:6379`, **ScyllaDB** on `127.0.0.1:9042`, and **MinIO** (S3 API on `127.0.0.1:8333`, console on `127.0.0.1:9001`). It also applies the Scylla schema and creates the default blob bucket. It does **not** start the `api` / `web` / `admin` compose services — use **`make compose-up`** (profile `full`) for the full containerized stack. Stop with **`make db-down`**. To remove containers **and** persisted compose volumes (fresh databases), run **`make db-clean`**.

**Full stack (`make compose-up` or `docker compose --profile full up -d`):** **api** on `127.0.0.1:8765`, **web** on `8081`, **admin** on `8082`; **mail-mta** exposes SMTP on host `2525`→container `25` and `2587`→`587`. Use **`make dev`** / **`make dev-api`** on the host to run split roles without Docker. Production Coolify layout: [docs/deploy-coolify.md](docs/deploy-coolify.md) and [ADR 0018](docs/adr/0018-monorepo-split-origin-deploy.md).

**Scylla:** The first time it allocates its volume, startup can take **1–2 minutes** before CQL on `9042` is ready. Compose waits for a real `cqlsh` probe (not just nodetool) before **`scylla-init`** applies [`libs/go/scyllastore/schema.cql`](libs/go/scyllastore/schema.cql); if init ever races again, [`docker/scylla-init.sh`](docker/scylla-init.sh) retries for several minutes.

If **`make db-up`** fails, ensure Docker is running (`docker info`), then try `docker compose pull`. Compose runs **Redis 7 Alpine** on port 6379 (same protocol as Valkey; `VALKEY_ADDR` still applies).

Then run the app with **`make dev`** (watches and restarts; auto-runs **`make db-up`**) or **`make dev-once`**, or export both variables before `go run` / `./bin/elvish`.

### CockroachDB/Postgres + Valkey (required in normal mode)

**`make dev`** / **`make dev-once`** default `COCKROACH_DSN` and `VALKEY_ADDR` to the same hosts/ports as **`make db-up`**, auto-run **`make db-up`** unless **`SKIP_AUTO_DB_UP=1`**, and also export **`SCYLLA_*`** / **`BLOB_S3_*`** for the host-published compose ports unless **`SKIP_MAIL_BACKENDS=1`** (see below). Production and ad-hoc `go run` should set **`COCKROACH_DSN`** (Postgres wire URI, e.g. `postgres://user@host:26257/db?sslmode=require`) plus **`VALKEY_ADDR`** (and optional **`VALKEY_PASSWORD`**, **`VALKEY_DB`**) explicitly; set mail variables the same way if you enable the mail subsystem.

With a non-empty **`COCKROACH_DSN`**, **`elvishapi` applies embedded SQL migrations** (goose) on startup before serving traffic.

Set **`ELVISH_ALLOW_EMPTY_DB=1`** only to run **without** those backends (static HTML from disk; register/login and admin persistence unavailable).

- **Register / login:** `POST /api/auth/register`, `POST /api/auth/login` (HTTP-only cookie `elvish_session`), or open **`/register`** / **`/login`** in the browser.
- **Bootstrap for admin:** `GET /api/bootstrap.json`.
- **OpenPGP public keys:** `POST /api/pgp/keys` (**admin** session) — listed at `/pgp/keys.json`, each at `/pgp/key/<fingerprint16>.asc`.
- **Migrate disk posts → SQL:** `make migrate` or `go run ./services/api/cmd/elvishapi -root . -migrate`. **`POST /api/migrate/posts`** does the same import over HTTP and requires an **admin** session.
- **Admin E2E:** `make test-e2e` (Playwright under [`e2e/`](e2e/); see [`e2e/README.md`](e2e/README.md)).

Connectivity check: `go run ./tools/elvishdb health` or `make db-health`.

### Legacy minisign (disk-only posts)

`make blog-sign` / `make blog-verify` use **`elvishsign`** on `services/api/content/blog/`. Live posts in SQL use **OpenPGP** detached signatures verified by the server (`libs/go/openpgp`).

## Build binary

```bash
make build
# produces bin/elvish
```

## File watching

**`make dev-watch`** uses [fswatch](https://emcrisostomo.github.io/fswatch/) to rebuild when `services/`, `libs/go/`, `apps/`, or module files change.

**`make dev-watch`** only rebuilds **`bin/elvish`** on those changes; run **`./bin/elvish`** yourself in another terminal if you prefer a compiled binary workflow.

## Content

- **Home / site config:** [services/api/content/home.json](services/api/content/home.json)
- **Blog:** Markdown under [services/api/content/blog/](services/api/content/blog/)
- **Blog metrics (optional):** `services/api/content/blog/metrics.json`
- **Uptime probes (optional):** `services/api/content/uptime.json`

Markdown is rendered with [Goldmark](https://github.com/yuin/goldmark).

## Deploy

Run **`elvishapi`**, **`apps/web`**, **`apps/admin`**, **`elvishmta`**, and **`elvishworker`** per [docs/runbooks/split-deploy.md](docs/runbooks/split-deploy.md). Operator routes under `/api/admin/*` require an admin session when Valkey is configured.

**Caching:** HTML references `/page.css` and `/site.js` with `?v=` from `content/home.json` `hash_short` (fallback: `version`). The service worker (`static/sw.js`) is served with injected version lines. Bump `hash_short` when you change CSS/JS.

**elvishapi:** Responses use `Cache-Control` aligned with [`static/_headers`](static/_headers) where applicable. HTML uses `private` cache directives when a `elvish_session` cookie is present so shared caches do not serve personalized nav. `/api/*` uses `no-store`. Text responses may be gzip-compressed when `Accept-Encoding: gzip` is sent (skipped for `Range` requests). In-process caching of parsed `home.json` and blog posts is controlled in **admin → Platform** (`content_cache_sec`, default `10`; `0` disables). Cache entries are dropped after successful admin post upsert, migrate, or PGP key upload.

**Verify caching (local):** With `make dev`, `make dev-api-once`, or `go run ./cmd/elvishapi -addr :8765 -root .` (with env set), run (use `curl -sD - -o /dev/null` for HTML so the request is GET; `curl -I` sends HEAD and the server returns 405 for `/`):

```bash
curl -sD - -o /dev/null http://127.0.0.1:8765/ | grep -iE 'cache-control|content-encoding'
curl -sD - -o /dev/null -H 'Accept-Encoding: gzip' http://127.0.0.1:8765/ | grep -iE 'cache-control|content-encoding|vary'
curl -sI 'http://127.0.0.1:8765/styles.css?v=test' | grep -i cache-control
curl -sD - -o /dev/null -H 'Cookie: elvish_session=fake' http://127.0.0.1:8765/ | grep -i cache-control
curl -sI http://127.0.0.1:8765/api/auth/me | grep -i cache-control
```

## Environment

**Product settings** (public URL, mail domain, CORS, registration, paid tier, DKIM selector/domain, uptime probes, captcha, telemetry) are configured in the **admin panel** at `/mail?view=admin` — see [ADR 0016](docs/adr/0016-operator-settings-in-sql.md). Legacy `ELVISH_*` product env vars are imported once on first boot when the database row is empty, then ignored.

### Bootstrap (required for production)

| Variable | Purpose |
|----------|---------|
| `COCKROACH_DSN` | Postgres or Cockroach connection string |
| `VALKEY_ADDR` | Valkey/Redis `host:port` |
| `VALKEY_PASSWORD` | Optional |
| `VALKEY_DB` | Numeric DB index (default `0`) |
| `COOKIE_SECURE` | `1` or `true` for `Secure` session cookies |
| `ELVISH_COMPONENT` | Optional cross-check (`api`/`mta`/`worker`); see [ADR 0017](docs/adr/0017-mandatory-split-deployment.md) |
| `ELVISH_HTTP_ENABLED` | `0`/`false` disables HTTP (default off for `mta`-only) |
| `ELVISH_BACKGROUND_JOBS` | **Do not set on API** — retention/deletion/uptime sweepers run on `elvishworker` only ([split-deploy](docs/runbooks/split-deploy.md)) |
| `ELVISH_ALLOW_EMPTY_DB` | `1`/`true` for static-only demos without DB |

### Secrets and paths

| Variable | Purpose |
|----------|---------|
| `ELVISH_MFA_ENCRYPTION_KEY` | AES key for server-readable MFA secrets |
| `ELVISH_AUTO_GEN_MFA_KEY` | Dev: auto-generate MFA key at `<root>/data/mfa.key` |
| `ELVISH_MFA_ENCRYPTION_KEY_PATH` | Optional path for auto-generated MFA key |
| `ELVISH_RELAY_KEY_PATH` | Mode C relay OpenPGP key (default `<root>/data/relay.asc` auto-gen) |
| `ELVISH_DKIM_KEY_PATH` | DKIM RSA PEM path (default `<root>/data/dkim.pem`; selector/domain in admin) |
| `ELVISH_OIDC_*` | Optional “Login with Elvish” issuer — see [ADR 0013](docs/adr/0013-login-with-elvish-oidc-issuer.md) |
| `ELVISH_ADDRESS_RESERVATION_KEY` | HMAC for deleted-address tombstones |

### Development helpers

| Variable | Purpose |
|----------|---------|
| `SKIP_AUTO_DB_UP` | Skip `make db-up` in **`make dev`** / **`make dev-once`** |
| `SKIP_MAIL_BACKENDS` | Skip default `SCYLLA_*` / `BLOB_S3_*` injection in dev |
| `ELVISH_INTEGRATION_DB` | Enable Docker-backed integration tests |

### E2EE mail subsystem

The mail subsystem (see `docs/e2ee-mail-spec.md` and `docs/adr/0003`–`0010`) requires three additional backends — ScyllaDB for mailbox-scale projections, an S3-compatible object store for ciphertext blobs, and (optionally) DKIM + relay keys. `make db-up` brings them all up alongside Cockroach + Valkey.

The compose UI exposes three send modes (`static/mail/compose.jsx`):

- **Mode A — PGP direct** (ADR 0005). Recipient already has a published OpenPGP key. The browser PGP-encrypts the body before upload; the server only ever stores ciphertext.
- **Mode B — Protected link** (ADR 0009). The browser AES-GCM-wraps the body under a sender-chosen password and uploads opaque ciphertext + KDF-wrapped message key. The recipient receives a `/m/{token}` URL and unlocks in their browser. The password is **never** sent to the server.
- **Mode C — Plaintext relay** (ADR 0010). The body is plain MIME on the wire, but it is PGP-wrapped to the operator-held relay key (`ELVISH_RELAY_KEY_PATH`) before persistence. The worker decrypts in process memory, signs with DKIM, and sends, then wipes the buffer. No plaintext at rest.

Both Mode B notifications and Mode C send paths require the relay key to be configured. `cmd/elvishrelay generate` mints one in armored form.

For local development, `make dev`, `make dev-once`, and `docker compose up` now opt into `ELVISH_AUTO_GEN_MFA_KEY=1`, which bootstraps a reusable MFA encryption key at `<root>/data/mfa.key` when `ELVISH_MFA_ENCRYPTION_KEY` is unset.

When a logged-in user opens `/mail`, the unlock modal (`static/mail/unlock-modal.jsx`) auto-bootstraps any missing key in the correct order: account key first, then a default identity wrapped to that account public key. The user only types their password.

| Variable | Purpose |
|----------|---------|
| `SCYLLA_HOSTS` | Comma-separated `host:port` list for ScyllaDB cluster (e.g. `127.0.0.1:9042`) |
| `SCYLLA_KEYSPACE` | Keyspace for mail manifests (default `elvish_mail`) |
| `SCYLLA_USERNAME` | Optional CQL username |
| `SCYLLA_PASSWORD` | Optional CQL password |
| `SCYLLA_LOCAL_DC` | Optional DC name for `DCAwareRoundRobinPolicy` |
| `BLOB_S3_ENDPOINT` | S3 endpoint URL (e.g. `http://127.0.0.1:8333` for local MinIO) |
| `BLOB_S3_REGION` | SigV4 region (default `us-east-1`) |
| `BLOB_S3_BUCKET` | Bucket name for `mail/...` and `outbox/...` keys (auto-created if missing) |
| `BLOB_S3_ACCESS_KEY` | Access key for SigV4 signing |
| `BLOB_S3_SECRET_KEY` | Secret key for SigV4 signing |
| `BLOB_S3_FORCE_PATH_STYLE` | `1`/`true` for path-style addressing (required for local MinIO and many S3-compatible stores) |
| `ELVISH_HOSTNAME` | EHLO/HELO hostname (defaults to `mx.{platform_mail_domain}` from admin) |
| `ELVISH_SMTP_ADDR` | Inbound MX listen address (port 25); empty disables |
| `ELVISH_SMTP_SUBMISSION_ADDR` | Submission listen address (port 587); empty disables |
| `ELVISH_SMTP_ALLOW_PLAIN_AUTH` | `1`/`true` for AUTH PLAIN without TLS (dev only) |
| `ELVISH_SMTP_TLS_CERT_PATH` / `ELVISH_SMTP_TLS_KEY_PATH` | Optional SMTP TLS |
| `ELVISH_DKIM_KEY_PATH` | DKIM PEM path (selector/domain in admin **Testing → DKIM**) |
| `ELVISH_RELAY_KEY_PATH` | Mode C relay key (auto-generated at `<root>/data/relay.asc` when unset) |
