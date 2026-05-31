# ELVISH — live server (CockroachDB/Postgres + Valkey required unless ELVISH_ALLOW_EMPTY_DB=1) + static assets
#
# `make dev` uses fswatch for auto-restart (brew install fswatch). Use `make dev-once` for a single `go run`.
# `make dev` / `make dev-once` auto-run `make db-up` unless SKIP_AUTO_DB_UP=1. Dev defaults include
# Scylla + MinIO S3 (same ports as compose). Set SKIP_MAIL_BACKENDS=1 to run without those exports
# (mail routes stay 503 unless you set SCYLLA_* / BLOB_S3_* yourself).

SHELL := /bin/bash

PORT ?= 8765
ROOT ?= .
BINARY ?= bin/elvish

# Shell prefix: DB + optional mail backends (hostPublished ports from docker-compose.yml).
define DEV_ENV_EXPORTS
	export COCKROACH_DSN="$${COCKROACH_DSN:-postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable}"; \
	export VALKEY_ADDR="$${VALKEY_ADDR:-127.0.0.1:6379}"; \
	export ELVISH_AUTO_GEN_MFA_KEY="$${ELVISH_AUTO_GEN_MFA_KEY:-1}"; \
	if [ "$${SKIP_MAIL_BACKENDS:-}" != "1" ]; then \
		export SCYLLA_HOSTS="$${SCYLLA_HOSTS:-127.0.0.1:9042}"; \
		export SCYLLA_KEYSPACE="$${SCYLLA_KEYSPACE:-elvish_mail}"; \
		export BLOB_S3_ENDPOINT="$${BLOB_S3_ENDPOINT:-http://127.0.0.1:8333}"; \
		export BLOB_S3_REGION="$${BLOB_S3_REGION:-us-east-1}"; \
		export BLOB_S3_BUCKET="$${BLOB_S3_BUCKET:-elvish-mail}"; \
		export BLOB_S3_ACCESS_KEY="$${BLOB_S3_ACCESS_KEY:-elvish-dev}"; \
		export BLOB_S3_SECRET_KEY="$${BLOB_S3_SECRET_KEY:-elvish-dev-secret}"; \
		export BLOB_S3_FORCE_PATH_STYLE="$${BLOB_S3_FORCE_PATH_STYLE:-1}"; \
	fi;
endef

define DEV_AUTO_DB_UP
	if [ "$${SKIP_AUTO_DB_UP:-}" = "1" ]; then \
		printf '%s\n' "[elvishserver] skipping automatic db-up (SKIP_AUTO_DB_UP=1)"; \
	else \
		printf '%s\n' "[elvishserver] ensuring local Docker backends via make db-up"; \
		$(MAKE) -s db-up || exit $$?; \
	fi;
endef

.PHONY: openapi openapi-check codeql codeql-go codeql-js codeql-all codeql-summary codeql-clean codeql-install-hint codeql-build compose-coolify-config lint-invariants
openapi:
	go run ./cmd/apiroutes -write

openapi-check:
	go run ./cmd/apiroutes -check
.PHONY: fmt vet lint test test-race test-integration test-e2e test-mail-e2e vuln bench-smoke check

# Precompiled browser bundles (React 19, OpenPGP 6 vendor copy, mail search worker) into static/dist/.
# Requires Node.js. First run installs frontend/node_modules via npm ci. Set SKIP_STATIC_JS=1 to skip (use prebuilt static/dist only).
static-js:
	@if [ "$${SKIP_STATIC_JS:-}" = "1" ]; then printf '%s\n' "[static-js] skipped (SKIP_STATIC_JS=1)"; exit 0; fi
	@command -v node >/dev/null 2>&1 || { printf '%s\n' "node required for static-js (or SKIP_STATIC_JS=1 with existing static/dist)"; exit 1; }
	@if [ ! -d frontend/node_modules ]; then printf '%s\n' "[static-js] npm ci in frontend/ ..."; (cd frontend && npm ci); fi
	@node frontend/build.mjs

build:
ifneq ($(SKIP_STATIC_JS),1)
	@$(MAKE) static-js
endif
	@mkdir -p bin
	go build -o $(BINARY) ./cmd/elvishserver

CONSOLE_PORT ?= 8780
CONSOLE_BINARY ?= bin/elvishconsole

build-console:
ifneq ($(SKIP_STATIC_JS),1)
	@$(MAKE) static-js
endif
	@mkdir -p bin
	go build -o $(CONSOLE_BINARY) ./cmd/elvishconsole

dev-console:
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	export ELVISH_CONSOLE_VAULT_KEY="$${ELVISH_CONSOLE_VAULT_KEY:-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=}"; \
	export ELVISH_STAFF_BOOTSTRAP_EMAILS="$${ELVISH_STAFF_BOOTSTRAP_EMAILS:-ops@localhost}"; \
	export ELVISH_STAFF_BOOTSTRAP_PASSWORD="$${ELVISH_STAFF_BOOTSTRAP_PASSWORD:-changeme-console-dev}"; \
	go run ./cmd/elvishconsole -addr :$(CONSOLE_PORT) -root $(ROOT)

# Run elvishserver on http://127.0.0.1:$(PORT)/ (not Docker). Auto-starts local Docker backends unless
# SKIP_AUTO_DB_UP=1. For one shot without watching: make dev-once
# Requires fswatch. For one shot without watching: make dev-once
dev:
	@command -v fswatch >/dev/null 2>&1 || { printf '%s\n' "fswatch required: brew install fswatch (or: make dev-once)"; exit 1; }
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	pid=""; \
	kill_pid() { \
		local target="$$1"; \
		if [ -z "$$target" ]; then \
			return 0; \
		fi; \
		kill -TERM "$$target" 2>/dev/null || true; \
		for _ in 1 2 3 4 5 6 7 8 9 10; do \
			if ! kill -0 "$$target" 2>/dev/null; then return 0; fi; \
			sleep 0.05; \
		done; \
		kill -KILL "$$target" 2>/dev/null || true; \
		wait "$$target" 2>/dev/null || true; \
	}; \
	kill_stale_listener() { \
		local listener listener_cmd; \
		listener="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | awk 'NR == 1 { print; exit }')"; \
		if [ -z "$$listener" ]; then \
			return 0; \
		fi; \
		listener_cmd="$$(ps -p "$$listener" -o command= 2>/dev/null || true)"; \
		case "$$listener_cmd" in \
			*elvishserver*|*bin/elvish*) \
				printf '%s\n' "[elvishserver] stopping stale listener $$listener on :$(PORT)"; \
				kill_pid "$$listener"; \
				;; \
			*) \
				printf '%s\n' "[elvishserver] port $(PORT) already in use by $$listener_cmd"; \
				return 1; \
				;; \
		esac; \
	}; \
	cleanup() { \
		if [ -n "$$pid" ]; then \
			kill_pid "$$pid"; \
		fi; \
		kill_stale_listener || return $$?; \
		sleep 0.15; \
	}; \
	trap 'cleanup; exit 130' INT; \
	trap 'cleanup; exit 143' TERM; \
	trap cleanup EXIT; \
	while true; do \
		kill_stale_listener || exit $$?; \
		printf '%s\n' "[elvishserver] http://127.0.0.1:$(PORT)/ — Ctrl+C to stop; watching for changes"; \
		if $(MAKE) -s build; then \
			"$(BINARY)" -addr :$(PORT) -root $(ROOT) & \
			pid=$$!; \
		else \
			pid=""; \
			printf '%s\n' "[elvishserver] build failed — waiting for changes"; \
		fi; \
		fswatch -1 -r \
			"$(ROOT)/content" \
			"$(ROOT)/static" \
			"$(ROOT)/templates" \
			"$(ROOT)/cmd" \
			"$(ROOT)/internal" \
			"$(ROOT)/go.mod" \
			"$(ROOT)/go.sum" || { st=$$?; cleanup; exit $$st; }; \
		printf '%s\n' "[elvishserver] change detected — restarting"; \
		cleanup; \
		pid=""; \
	done

# Single `go run` (no fswatch). Same env defaults and automatic db-up behavior as make dev.
dev-once:
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	go run ./cmd/elvishserver -addr :$(PORT) -root $(ROOT)

# Rebuild $(BINARY) when sources change; run the binary separately (e.g. ./bin/elvish). For build + run with auto-restart, use make dev.
dev-watch:
	@command -v fswatch >/dev/null 2>&1 || { printf '%s\n' "fswatch required: brew install fswatch"; exit 1; }
	@while fswatch -1 -r \
		"$(ROOT)/content" \
		"$(ROOT)/static" \
		"$(ROOT)/templates" \
		"$(ROOT)/cmd" \
		"$(ROOT)/internal" \
		"$(ROOT)/go.mod" \
		"$(ROOT)/go.sum"; do \
		$(MAKE) -s build && printf '%s\n' "[elvishserver] rebuilt"; \
	done

# Import posts from content/blog into SQL, then exit.
migrate:
	COCKROACH_DSN="$${COCKROACH_DSN:-postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable}" \
	go run ./cmd/elvishserver -root $(ROOT) -migrate

# Detached minisign signatures for Markdown posts (needs content/blog/signing.key; MINISIGN_PASSWORD if encrypted).
blog-sign:
	@key="$(ROOT)/content/blog/signing.key"; \
	if [ ! -f "$$key" ]; then \
		printf '%s\n' "Missing $$key" "" "Create a key pair first, then sign:" \
			"  go run ./cmd/elvishsign keygen -out $(ROOT)/content/blog -password 'your-password'" \
			"  make blog-sign"; \
		exit 1; \
	fi; \
	go run ./cmd/elvishsign sign -key "$$key" $$(find $(ROOT)/content/blog -maxdepth 1 -name '*.md' ! -name README.md)

blog-verify:
	@pub="$(ROOT)/content/blog/signing.pub"; \
	if [ ! -f "$$pub" ]; then \
		printf '%s\n' "Missing $$pub" "" "Generate keys (creates signing.pub + signing.key):" \
			"  go run ./cmd/elvishsign keygen -out $(ROOT)/content/blog -password 'your-password'"; \
		exit 1; \
	fi; \
	go run ./cmd/elvishsign verify -pub "$$pub" $$(find $(ROOT)/content/blog -maxdepth 1 -name '*.md' ! -name README.md)

# Ping CockroachDB / Valkey if COCKROACH_DSN and/or VALKEY_ADDR are set (no-op if unset).
db-health:
	@go run ./cmd/elvishdb health

# Start local CockroachDB + Valkey + Scylla + MinIO (no api/frontend containers). Full stack: docker compose up -d
db-up:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' "docker not found — install Docker Desktop or the Docker engine."; exit 1; }
	docker compose up -d cockroach valkey scylla minio || { printf '%s\n' "docker compose failed — is Docker running? Try: docker info"; exit 1; }
	@printf '%s\n' "Applying Scylla schema (idempotent; waits for Scylla healthy)..." && docker compose run --rm scylla-init
	@printf '%s\n' "Bootstrapping MinIO bucket (idempotent)..." && docker compose run --rm minio-init
	@printf '%s\n' "Cockroach: postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable" "Valkey:    127.0.0.1:6379" "Scylla:    127.0.0.1:9042 (CQL)" "Blobs:     http://127.0.0.1:8333 (MinIO S3)" "Console:   http://127.0.0.1:9001"

db-down:
	docker compose down

# Stop compose stack and delete named volumes (Cockroach, Scylla, MinIO — all SQL/blob/mail local data).
db-clean:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' "docker not found"; exit 1; }
	docker compose down -v --remove-orphans

test-mail-e2e:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' "docker required for full mail e2e"; exit 1; }
	$(MAKE) db-up
	@$(DEV_ENV_EXPORTS) \
	go run ./cmd/elvishmailtest no-plaintext-audit && \
	go run ./cmd/elvishmailtest bootstrap-and-selfcheck

fmt:
	@test -z "$$(gofmt -l .)" || (printf '%s\n' "gofmt needed on:"; gofmt -l .; exit 1)

vet:
	go vet ./...

lint:
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.63.4 run
	@$(MAKE) -s lint-invariants

lint-invariants:
	@chmod +x scripts/lint-invariants.sh
	@scripts/lint-invariants.sh

compose-coolify-config:
	@chmod +x scripts/validate-coolify-compose.sh
	@scripts/validate-coolify-compose.sh

test:
	go test ./...

# Docker-backed Cockroach + goose + mailstore (set ELVISH_INTEGRATION_DB=1).
test-integration:
	ELVISH_INTEGRATION_DB=1 go test ./internal/db -run TestCockroachMigrationsAndMailstore -count=1 -v
	ELVISH_INTEGRATION_DB=1 go test ./internal/httpserver -run TestAdminUptimeAPIIntegration -count=1 -v

# Playwright admin smoke (start elvishserver separately; see e2e/README.md).
test-e2e:
	@command -v npm >/dev/null 2>&1 || { printf '%s\n' "npm required for Playwright e2e"; exit 1; }
	cd e2e && npm ci && npx playwright install chromium
	cd e2e && BASE_URL="$${BASE_URL:-http://127.0.0.1:8765}" npm test

test-race:
	go test -race ./...

vuln:
	go run golang.org/x/vuln/cmd/govulncheck@latest ./...

bench-smoke:
	go test -bench=. -benchtime=1x ./...

check: fmt vet lint static-js openapi-check test-race vuln

# --- CodeQL (local; mirrors .github/workflows/codeql-analysis.yml server job) ---
CODEQL ?= codeql
CODEQL_DIR ?= .codeql
CODEQL_CONFIG ?= .github/codeql/codeql-config.yml
CODEQL_MODEL_PACK ?= $(abspath .github/codeql/elvish-go-models)
CODEQL_GO_DB ?= $(CODEQL_DIR)/databases/go
CODEQL_JS_DB ?= $(CODEQL_DIR)/databases/javascript
CODEQL_GO_SARIF ?= $(CODEQL_DIR)/results/go.sarif
CODEQL_JS_SARIF ?= $(CODEQL_DIR)/results/js.sarif

.PHONY: codeql codeql-go codeql-js codeql-all codeql-summary codeql-summary-go codeql-clean codeql-check codeql-install-hint codeql-build

codeql-install-hint:
	@printf '%s\n' \
		"CodeQL CLI not found. Install one of:" \
		"  brew install codeql" \
		"  https://github.com/github/codeql-action/releases" \
		"" \
		"Then run: make codeql-go"

codeql-check:
	@command -v $(CODEQL) >/dev/null 2>&1 || { $(MAKE) -s codeql-install-hint; exit 1; }
	@grep -qE '^[[:space:]]*-[[:space:]]*local:' $(CODEQL_CONFIG) && { \
		printf '%s\n' "Remove 'local:' packs from $(CODEQL_CONFIG)"; exit 1; \
	} || true
	@$(CODEQL) version | head -1

codeql-build:
	CGO_ENABLED=0 go build -v ./...

codeql: codeql-go

codeql-all: codeql-go codeql-js

codeql-go: codeql-check
	@mkdir -p $(CODEQL_DIR)/databases $(CODEQL_DIR)/results
	@printf '%s\n' "[codeql] creating Go database ..."
	$(CODEQL) database create $(CODEQL_GO_DB) --overwrite \
		--language=go \
		--source-root="$(CURDIR)" \
		--codescanning-config="$(CODEQL_CONFIG)" \
		--command='make codeql-build'
	@printf '%s\n' "[codeql] analyzing Go (elvish/go-models) ..."
	$(CODEQL) database analyze $(CODEQL_GO_DB) \
		--format=sarif-latest \
		--output="$(CODEQL_GO_SARIF)" \
		--additional-packs="$(CODEQL_MODEL_PACK)" \
		--model-packs=elvish/go-models
	@printf '%s\n' "[codeql] Go SARIF: $(CODEQL_GO_SARIF)"

codeql-js: codeql-check
	@mkdir -p $(CODEQL_DIR)/databases $(CODEQL_DIR)/results
	@printf '%s\n' "[codeql] creating JavaScript/TypeScript database ..."
	$(CODEQL) database create $(CODEQL_JS_DB) --overwrite \
		--language=javascript \
		--source-root="$(CURDIR)" \
		--codescanning-config="$(CODEQL_CONFIG)"
	@printf '%s\n' "[codeql] analyzing JavaScript/TypeScript ..."
	$(CODEQL) database analyze $(CODEQL_JS_DB) \
		--format=sarif-latest \
		--output="$(CODEQL_JS_SARIF)"
	@printf '%s\n' "[codeql] JS SARIF: $(CODEQL_JS_SARIF)"

codeql-summary-go: codeql-check
	@test -d "$(CODEQL_GO_DB)" || { printf '%s\n' "missing $(CODEQL_GO_DB) — run make codeql-go first"; exit 1; }
	@$(CODEQL) database interpret-results "$(CODEQL_GO_DB)" --format=CSV --max-path-problems=30 2>/dev/null | head -40 || \
		$(CODEQL) database interpret-results "$(CODEQL_GO_DB)" --format=LGTM --max-path-problems=30 | head -40

codeql-summary: codeql-summary-go

codeql-clean:
	rm -rf "$(CODEQL_DIR)"
