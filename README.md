# ELVISH (live site + admin)

ELVish is **open source** under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) (see [LICENSE](LICENSE)). Contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md). Community: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security reports: [SECURITY.md](SECURITY.md).

When you publish your own deployment, point the site footer **Source** link at your public clone by editing `content/home.json` (`footer.pages`, entry with `"label": "Source"`) instead of the default `"#"`.

## Documentation

- **Source hosting** — development uses **GitLab** (private today; public when you choose). Vulnerability reporting is described in [SECURITY.md](SECURITY.md).
- **[docs/README.md](docs/README.md)** — index of design docs, ADRs, and specs
- **HTTP API catalog** — OpenAPI 3 at `/api/openapi.yaml` and Redoc UI at `/api/docs` (regenerate with `make openapi`; see [docs/openapi/supplemental.yaml](docs/openapi/supplemental.yaml))
- **[docs/architecture.md](docs/architecture.md)** — system overview and diagram
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — dev commands, conventions, code map
- **[AGENTS.md](AGENTS.md)** — short orientation for automation / AI assistants

Go HTTP server **`elvishserver`** serves HTML (same templates as before), static assets from `static/`, JSON API under `/api/`, and the React admin at `/admin/`. **Defaults** still come from `content/home.json` and Markdown in `content/blog/` when the SQL database has no posts yet. By default the process **refuses to start** until **CockroachDB/Postgres** (`COCKROACH_DSN`) and **Valkey** are configured in the environment **and** respond to a health ping (see `ELVISH_ALLOW_EMPTY_DB` below for the rare static-only case).

**Feeds** (at site root): RSS `/feed.xml`, Atom `/atom.xml`, [JSON Feed 1.1](https://jsonfeed.org/version/1.1) `/feed.json`. `<link rel="alternate">` is emitted on home, log index, and post pages.

## Run locally

```bash
make db-up   # once: CockroachDB + Valkey + Scylla + MinIO (no app containers); applies Scylla schema and creates the S3 bucket
make dev     # local `go run` with auto-restart on changes (needs fswatch: brew install fswatch; auto-runs db-up)
```

Use **`make dev-once`** for a single local run without file watching; it also auto-runs **`make db-up`** unless you set **`SKIP_AUTO_DB_UP=1`**. Plain `go run ./cmd/elvishserver -addr :8765 -root .` **does not** inject `COCKROACH_DSN` / `VALKEY_ADDR` (or mail backend vars) — export them yourself, use **`make dev-once`**, or use **`ELVISH_ALLOW_EMPTY_DB=1`** only if you intentionally want a disk-only demo without auth.

For site-only work without Scylla/S3 locally, run **`SKIP_AUTO_DB_UP=1 SKIP_MAIL_BACKENDS=1 make dev`** so the server starts without booting the Docker mail stack (mail APIs stay unavailable until you export `SCYLLA_*` / `BLOB_S3_*`).

Open `http://127.0.0.1:8765/`. Admin: `http://127.0.0.1:8765/admin/`.

**Auth pages (browser):** `/register` and `/login` — same API as the modals; after success, admins go to `/admin/`, others to `/`.

### Local databases (Docker Compose)

From the repo root:

```bash
make db-up
# same as: docker compose up -d cockroach valkey scylla minio
# then: docker compose run --rm scylla-init
# then: docker compose run --rm minio-init
```

This starts **CockroachDB** on `127.0.0.1:26257`, **Valkey** on `127.0.0.1:6379`, **ScyllaDB** on `127.0.0.1:9042`, and **MinIO** (S3 API on `127.0.0.1:8333`, console on `127.0.0.1:9001`). It also applies the Scylla schema and creates the default blob bucket. It does **not** start the `api` / `frontend` compose services — use **`docker compose up -d`** if you want the full containerized stack. Stop with **`make db-down`**. To remove containers **and** persisted compose volumes (fresh databases), run **`make db-clean`**.

**Full stack (`docker compose up -d`):** traffic is meant to enter through **frontend** on `127.0.0.1:8765`, which proxies `/api/` to **api** on the internal network. The **api** service is not published on a host port by default so clients cannot bypass the proxy and spoof `X-Forwarded-For` against rate limits. To reach **elvishserver** directly from the host (debugging), add `ports: ["8766:8765"]` under `api` in a [Compose override](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/) file; only use `ELVISH_TRUST_FORWARDED_FOR=1` when a **trusted** reverse proxy sets or strips forwarded headers (see the environment table below).

**Scylla:** The first time it allocates its volume, startup can take **1–2 minutes** before CQL on `9042` is ready. Compose waits for a real `cqlsh` probe (not just nodetool) before **`scylla-init`** applies [`internal/scyllastore/schema.cql`](internal/scyllastore/schema.cql); if init ever races again, [`docker/scylla-init.sh`](docker/scylla-init.sh) retries for several minutes.

If **`make db-up`** fails, ensure Docker is running (`docker info`), then try `docker compose pull`. Compose runs **Redis 7 Alpine** on port 6379 (same protocol as Valkey; `VALKEY_ADDR` still applies).

Then run the app with **`make dev`** (watches and restarts; auto-runs **`make db-up`**) or **`make dev-once`**, or export both variables before `go run` / `./bin/elvish`.

### CockroachDB/Postgres + Valkey (required in normal mode)

**`make dev`** / **`make dev-once`** default `COCKROACH_DSN` and `VALKEY_ADDR` to the same hosts/ports as **`make db-up`**, auto-run **`make db-up`** unless **`SKIP_AUTO_DB_UP=1`**, and also export **`SCYLLA_*`** / **`BLOB_S3_*`** for the host-published compose ports unless **`SKIP_MAIL_BACKENDS=1`** (see below). Production and ad-hoc `go run` should set **`COCKROACH_DSN`** (Postgres wire URI, e.g. `postgres://user@host:26257/db?sslmode=require`) plus **`VALKEY_ADDR`** (and optional **`VALKEY_PASSWORD`**, **`VALKEY_DB`**) explicitly; set mail variables the same way if you enable the mail subsystem.

With a non-empty **`COCKROACH_DSN`**, **`elvishserver` applies embedded SQL migrations** (goose) on startup before serving traffic.

Set **`ELVISH_ALLOW_EMPTY_DB=1`** only to run **without** those backends (static HTML from disk; register/login and admin persistence unavailable).

- **Register / login:** `POST /api/auth/register`, `POST /api/auth/login` (HTTP-only cookie `elvish_session`), or open **`/register`** / **`/login`** in the browser.
- **Bootstrap for admin:** `GET /api/bootstrap.json` (admin also falls back to `/admin/bootstrap.json` if present).
- **OpenPGP public keys:** `POST /api/pgp/keys` (**admin** session) — listed at `/pgp/keys.json`, each at `/pgp/key/<fingerprint16>.asc`.
- **Migrate disk posts → SQL:** `make migrate` or `go run ./cmd/elvishserver -root . -migrate`. **`POST /api/migrate/posts`** does the same import over HTTP and requires an **admin** session.
- **Admin E2E:** `make test-e2e` (Playwright under [`e2e/`](e2e/); see [`e2e/README.md`](e2e/README.md)).

Connectivity check: `go run ./cmd/elvishdb health` or `make db-health`.

### Legacy minisign (disk-only posts)

`make blog-sign` / `make blog-verify` use **`elvishsign`** for detached minisign signatures on files under `content/blog/` (see [content/blog/README.md](content/blog/README.md)). Live posts in SQL use **OpenPGP** detached signatures verified by the server (`internal/openpgp`).

## Build binary

```bash
make build
# produces bin/elvish
```

## File watching

**`make dev`** uses [fswatch](https://emcrisostomo.github.io/fswatch/) to restart **`go run`** when `content/`, `static/`, `templates/`, `cmd/`, `internal/`, or module files change.

**`make dev-watch`** only rebuilds **`bin/elvish`** on those changes; run **`./bin/elvish`** yourself in another terminal if you prefer a compiled binary workflow.

## Content

- **Home / site config:** [content/home.json](content/home.json) — hero, tools, terminal boot lines, nav, footer, log index chrome, tweak defaults. Optional full JSON override in SQL (`site_config.home_json`) when you wire a writer in admin.
- **Blog:** Markdown under [content/blog/](content/blog/) (see [content/blog/README.md](content/blog/README.md)). With the posts table empty, the server reads these files; after migration or API upserts, posts are served from SQL.
- **Blog metrics (optional):** [content/blog/metrics.json](content/blog/metrics.json) merges `bytes`, `reach`, `type`, `time` per slug when loading from disk.
- **Uptime probes (optional):** [content/uptime.json](content/uptime.json) — default probe paths plus `include_tools_from_home`; merged with admin/SQL settings when enabled.

Markdown is rendered with [Goldmark](https://github.com/yuin/goldmark).

## Deploy

Run **`elvishserver`** behind your reverse proxy (TLS, HTTP/2, etc.) with env for Cockroach/Postgres and Valkey. **Protect `/admin/`** at the edge until you rely on API auth alone.

**Caching:** HTML references `/page.css` and `/site.js` with `?v=` from `content/home.json` `hash_short` (fallback: `version`). The service worker (`static/sw.js`) is served with injected version lines. Bump `hash_short` when you change CSS/JS.

**elvishserver:** Responses use `Cache-Control` aligned with [`static/_headers`](static/_headers) where applicable. HTML uses `private` cache directives when a `elvish_session` cookie is present so shared caches do not serve personalized nav. `/api/*` uses `no-store`. Text responses may be gzip-compressed when `Accept-Encoding: gzip` is sent (skipped for `Range` requests). In-process caching of parsed `home.json` and blog posts is controlled with **`ELVISH_CONTENT_CACHE_SEC`** (default `10`; set `0` to disable). Cache entries are dropped after successful admin post upsert, migrate, or PGP key upload.

**Verify caching (local):** With `make dev`, `make dev-once`, or `go run ./cmd/elvishserver -addr :8765 -root .` (with env set), run (use `curl -sD - -o /dev/null` for HTML so the request is GET; `curl -I` sends HEAD and the server returns 405 for `/`):

```bash
curl -sD - -o /dev/null http://127.0.0.1:8765/ | grep -iE 'cache-control|content-encoding'
curl -sD - -o /dev/null -H 'Accept-Encoding: gzip' http://127.0.0.1:8765/ | grep -iE 'cache-control|content-encoding|vary'
curl -sI 'http://127.0.0.1:8765/styles.css?v=test' | grep -i cache-control
curl -sD - -o /dev/null -H 'Cookie: elvish_session=fake' http://127.0.0.1:8765/ | grep -i cache-control
curl -sI http://127.0.0.1:8765/api/auth/me | grep -i cache-control
```

## Environment

| Variable | Purpose |
|----------|---------|
| `COCKROACH_DSN` | Postgres or Cockroach connection string (e.g. `postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable`) |
| `VALKEY_ADDR` | Valkey/Redis address `host:port` |
| `VALKEY_PASSWORD` | Optional |
| `VALKEY_DB` | Numeric DB index (default `0`) |
| `COOKIE_SECURE` | `1` or `true` to set `Secure` on session cookies |
| `ELVISH_MFA_ENCRYPTION_KEY` | Hex or base64 AES key (16/24/32 bytes after decode) used to encrypt server-readable MFA secrets such as TOTP seeds |
| `ELVISH_AUTO_GEN_MFA_KEY` | `1`/`true` to auto-generate and persist a local-development MFA key at startup when `ELVISH_MFA_ENCRYPTION_KEY` is unset |
| `ELVISH_MFA_ENCRYPTION_KEY_PATH` | Optional path for the auto-generated local-development MFA key file (default `<root>/data/mfa.key`) |
| `ELVISH_DISABLE_REGISTRATION` | `1` or `true` to reject `POST /api/auth/register` when at least one user already exists (first-user bootstrap still allowed) |
| `ELVISH_TRUST_FORWARDED_FOR` | `1` or `true` to use `X-Real-IP` / `X-Forwarded-For` for rate limits (enable only behind a trusted reverse proxy that strips client-spoofed headers) |
| `ELVISH_CONTENT_CACHE_SEC` | In-process TTL for parsed site config and posts in `elvishserver` (default `10`; `0` disables) |
| `ELVISH_ALLOW_EMPTY_DB` | `1` or `true` to allow startup **without** `COCKROACH_DSN` / `VALKEY_ADDR` (static-only; not for production) |
| `SKIP_AUTO_DB_UP` | Set to `1` with **`make dev`** / **`make dev-once`** to skip the automatic `make db-up` preflight |
| `SKIP_MAIL_BACKENDS` | Set to `1` with **`make dev`** / **`make dev-once`** to skip injecting default `SCYLLA_*` / `BLOB_S3_*` (use when Docker mail backends are stopped; mail routes return 503 unless you export those vars yourself) |

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
| `ELVISH_MAIL_DOMAIN` | Default domain accepted by the inbound MX (e.g. `elvish.email`) |
| `ELVISH_HOSTNAME` | EHLO/HELO greeting and `Received:` host (e.g. `mx.elvish.email`) |
| `ELVISH_SMTP_ADDR` | Listen address for inbound MX (port 25); empty disables it |
| `ELVISH_SMTP_SUBMISSION_ADDR` | Listen address for AUTH submission (port 587); empty disables it |
| `ELVISH_SMTP_ALLOW_PLAIN_AUTH` | `1`/`true` to allow `AUTH PLAIN` without TLS (only for local/dev) |
| `ELVISH_DKIM_DOMAIN` | DKIM `d=` (e.g. `elvish.email`) — outbound mail is signed when domain+selector+key are all set |
| `ELVISH_DKIM_SELECTOR` | DKIM `s=` (e.g. `mail`) |
| `ELVISH_DKIM_KEY_PATH` | Path to PEM-encoded RSA private key used for `rsa-sha256` signatures |
| `ELVISH_RELAY_KEY_PATH` | Path to ASCII-armored OpenPGP keypair used to wrap plaintext-relay outbox payloads at rest (Mode C). Generate manually with `go run ./cmd/elvishrelay genkey -out /var/lib/elvish/relay.asc` if desired. When unset, `elvishserver` now auto-generates a relay key at `<root>/data/relay.asc` on first run so plaintext-relay features, admin system mail, and protected-link recipient notifications work locally by default. |
| `ELVISH_PUBLIC_BASE_URL` | Public base URL used when composing `/m/{token}` URLs in protected-link notification emails (e.g. `https://elvish.email`). |
| `ELVISH_KEYSERVER_PROTON` | `1`/`true` (default) to query Proton's keyserver for `*.proton.me` / `*.protonmail.*` lookups |
| `ELVISH_KEYSERVER_HKPS` | Comma-separated HKPS pool (default `https://keys.openpgp.org,https://keyserver.ubuntu.com`) |
| `ELVISH_INTEGRATION_DB` | `1`/`true` to enable integration tests that spin up Cockroach in Docker (`make test-integration`) |
| `ELVISH_INTEGRATION_MAIL` | `1`/`true` to enable mail-stack integration tests (Cockroach + Scylla + MinIO via Docker; `make test-mail-e2e`) |
