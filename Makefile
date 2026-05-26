# ELVISH — split deploy: elvishapi + elvishmta + elvishworker (browser tier is elvishapi)
#
# `make dev` starts all roles (Overmind if installed, else scripts/dev-split.sh).
# App http://127.0.0.1:8765 · auto `make db-up` unless SKIP_AUTO_DB_UP=1

SHELL := /bin/bash

PORT ?= 8765
ROOT ?= .
BINARY ?= bin/elvishapi

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
		printf '%s\n' "[elvish] skipping automatic db-up (SKIP_AUTO_DB_UP=1)"; \
	else \
		printf '%s\n' "[elvish] ensuring local Docker backends via make db-up"; \
		$(MAKE) -s db-up || exit $$?; \
	fi;
endef

.PHONY: openapi openapi-check codeql codeql-go codeql-js codeql-all codeql-summary codeql-clean codeql-install-hint codeql-build docs-stage docs-serve docs-build docs-check docs-up
openapi:
	go run ./cmd/apiroutes -write

openapi-check:
	go run ./cmd/apiroutes -check
.PHONY: fmt vet lint test test-race test-integration test-e2e test-mail-e2e test-flutter test-ios check-clients vuln bench-smoke check dev dev-api dev-mta dev-worker dev-api-once dev-mta-once dev-worker-once compose-up

FLUTTER_APP ?= flutter/elvish_mail
IOS_SCHEME ?= IOS
IOS_SIMULATOR ?= platform=iOS Simulator,name=iPhone 17

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
	go build -o bin/elvishapi ./cmd/elvishapi
	go build -o bin/elvishmta ./cmd/elvishmta
	go build -o bin/elvishworker ./cmd/elvishworker

# Split stack (api + mta + worker). Prefer: brew install overmind
dev:
	@$(DEV_AUTO_DB_UP)
	@command -v overmind >/dev/null 2>&1 && overmind start -f Procfile || bash scripts/dev-split.sh

define DEV_API_EXPORTS
	export ELVISH_WEB_ORIGINS="$${ELVISH_WEB_ORIGINS:-http://127.0.0.1:$(PORT)}"; \
	export ELVISH_PUBLIC_BASE_URL="$${ELVISH_PUBLIC_BASE_URL:-http://127.0.0.1:$(PORT)}"; \
	export ELVISH_SMTP_ADDR=; \
	export ELVISH_SMTP_SUBMISSION_ADDR=;
endef

dev-api-once:
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	$(DEV_API_EXPORTS) \
	go run ./cmd/elvishapi -addr :$(PORT) -root $(ROOT)

dev-mta-once:
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	ELVISH_MAIL_DOMAIN=$${ELVISH_MAIL_DOMAIN:-localhost.test} \
	ELVISH_HOSTNAME=$${ELVISH_HOSTNAME:-localhost.test} \
	ELVISH_SMTP_ADDR=$${ELVISH_SMTP_ADDR:-:2525} \
	ELVISH_SMTP_SUBMISSION_ADDR=$${ELVISH_SMTP_SUBMISSION_ADDR:-:2587} \
	go run ./cmd/elvishmta -root $(ROOT)

dev-worker-once:
	@$(DEV_AUTO_DB_UP) \
	$(DEV_ENV_EXPORTS) \
	go run ./cmd/elvishworker -root $(ROOT)

dev-api: dev-api-once
dev-mta: dev-mta-once
dev-worker: dev-worker-once

# Aliases
dev-once: dev-api-once

compose-up:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' "docker not found"; exit 1; }
	$(MAKE) -s static-js
	docker compose --profile full up -d --build
	@printf '%s\n' \
	  "Full stack: http://127.0.0.1:8765 (elvishapi: static + API + SSR)" \
	  "Docs:      http://127.0.0.1:8766 (MkDocs static site)" \
	  "SMTP: localhost:2525 / :2587" \
	  "worker: mail outbox + sweepers"

# MkDocs Material static site from docs/ (see docs-site/mkdocs.yml, docker/docs/Dockerfile).
docs-stage:
	@python3 scripts/docs-stage.py

docs-serve: docs-stage
	@command -v python3 >/dev/null 2>&1 || { printf '%s\n' "python3 required (or: docker compose --profile docs up docs)"; exit 1; }
	@python3 -m pip install -q -r docs-site/requirements.txt
	@cd docs-site && python3 -m mkdocs serve -a 127.0.0.1:8766

docs-build: docs-stage
	@command -v python3 >/dev/null 2>&1 || { printf '%s\n' "python3 required (or: docker build -f docker/docs/Dockerfile .)"; exit 1; }
	@python3 -m pip install -q -r docs-site/requirements.txt
	@cd docs-site && python3 -m mkdocs build

docs-check: docs-stage
	@command -v python3 >/dev/null 2>&1 || { printf '%s\n' "python3 required"; exit 1; }
	@python3 -m pip install -q -r docs-site/requirements.txt
	@cd docs-site && python3 -m mkdocs build --strict

docs-up:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' "docker not found"; exit 1; }
	docker compose --profile docs up -d --build docs
	@printf '%s\n' "Documentation site: http://127.0.0.1:8766"

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
		$(MAKE) -s build && printf '%s\n' "[elvish] rebuilt"; \
	done

# Import posts from content/blog into SQL, then exit.
migrate:
	COCKROACH_DSN="$${COCKROACH_DSN:-postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable}" \
	go run ./cmd/elvishapi -root $(ROOT) -migrate

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
	sh scripts/lint-invariants.sh

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

# Flutter Android mail client (see docs/client-parity-roadmap.md).
test-flutter:
	@command -v flutter >/dev/null 2>&1 || { printf '%s\n' "flutter required — https://docs.flutter.dev/get-started/install"; exit 1; }
	cd $(FLUTTER_APP) && flutter pub get && flutter analyze --no-fatal-infos && flutter test

# iOS mail client (macOS + Xcode only).
test-ios:
	@command -v xcodebuild >/dev/null 2>&1 || { printf '%s\n' "xcodebuild required (macOS + Xcode)"; exit 1; }
	cd IOS && xcodebuild test -project IOS.xcodeproj -scheme $(IOS_SCHEME) -destination '$(IOS_SIMULATOR)' CODE_SIGNING_ALLOWED=NO

check-clients: test-flutter
	@if [ "$$(uname -s)" = "Darwin" ]; then $(MAKE) test-ios; else printf '%s\n' "[check-clients] skipping test-ios (not macOS)"; fi

vuln:
	go run golang.org/x/vuln/cmd/govulncheck@latest ./...

bench-smoke:
	go test -bench=. -benchtime=1x ./...

check: fmt vet lint static-js openapi-check test-race vuln

# --- CodeQL (local; mirrors .github/workflows/codeql-analysis.yml server job) ---
# Install CLI once: brew install codeql  (or https://github.com/github/codeql-action/releases)
CODEQL ?= codeql
CODEQL_DIR ?= .codeql
CODEQL_CONFIG ?= .github/codeql/codeql-config.yml
CODEQL_MODEL_PACK ?= $(abspath .github/codeql/elvish-go-models)
CODEQL_GO_DB ?= $(CODEQL_DIR)/databases/go
CODEQL_JS_DB ?= $(CODEQL_DIR)/databases/javascript
CODEQL_GO_SARIF ?= $(CODEQL_DIR)/results/go.sarif
CODEQL_JS_SARIF ?= $(CODEQL_DIR)/results/javascript.sarif

codeql-install-hint:
	@printf '%s\n' \
		"CodeQL CLI not found. Install one of:" \
		"  brew install codeql" \
		"  https://github.com/github/codeql-action/releases (download the codeql-bundle archive)" \
		"" \
		"Then run: make codeql-go   (or make codeql-all for Go + JS)"

codeql-check:
	@command -v $(CODEQL) >/dev/null 2>&1 || { $(MAKE) -s codeql-install-hint; exit 1; }
	@grep -qE '^[[:space:]]*-[[:space:]]*local:' $(CODEQL_CONFIG) && { \
		printf '%s\n' "Remove 'local:' packs from $(CODEQL_CONFIG) (see .github/codeql/README.md)"; exit 1; \
	} || true
	@$(CODEQL) version | head -1

# Traced by `codeql database create --command` (must be a single executable; not "VAR=1 go ...").
codeql-build:
	CGO_ENABLED=0 go build -v ./...

# Default local scan: Go only (matches most server alerts; fastest iteration).
codeql: codeql-go

codeql-all: codeql-go codeql-js

codeql-go: codeql-check
	@mkdir -p $(CODEQL_DIR)/databases $(CODEQL_DIR)/results
	@printf '%s\n' "[codeql] creating Go database (traces: make codeql-build) ..."
	$(CODEQL) database create $(CODEQL_GO_DB) --overwrite \
		--language=go \
		--source-root="$(CURDIR)" \
		--codescanning-config="$(CURDIR)/$(CODEQL_CONFIG)" \
		--command='make codeql-build'
	@printf '%s\n' "[codeql] analyzing Go (elvish/go-models MaD pack) ..."
	$(CODEQL) database analyze $(CODEQL_GO_DB) \
		--format=sarif-latest \
		--output="$(CODEQL_GO_SARIF)" \
		--additional-packs="$(CODEQL_MODEL_PACK)" \
		--model-packs=elvish/go-models
	@printf '%s\n' "[codeql] Go SARIF: $(CODEQL_GO_SARIF)" \
		"       summary: make codeql-summary-go"

codeql-js: codeql-check
	@mkdir -p $(CODEQL_DIR)/databases $(CODEQL_DIR)/results
	@printf '%s\n' "[codeql] creating JavaScript/TypeScript database (no build) ..."
	$(CODEQL) database create $(CODEQL_JS_DB) --overwrite \
		--language=javascript \
		--source-root="$(CURDIR)" \
		--codescanning-config="$(CURDIR)/$(CODEQL_CONFIG)"
	@printf '%s\n' "[codeql] analyzing JavaScript/TypeScript ..."
	$(CODEQL) database analyze $(CODEQL_JS_DB) \
		--format=sarif-latest \
		--output="$(CODEQL_JS_SARIF)" \
		--codescanning-config="$(CURDIR)/$(CODEQL_CONFIG)"
	@printf '%s\n' "[codeql] JS SARIF: $(CODEQL_JS_SARIF)"

codeql-summary-go: codeql-check
	@test -d "$(CODEQL_GO_DB)" || { printf '%s\n' "missing $(CODEQL_GO_DB) — run make codeql-go first"; exit 1; }
	@$(CODEQL) database interpret-results "$(CODEQL_GO_DB)" --format=text --max-path-problems=30

codeql-summary: codeql-summary-go

codeql-clean:
	rm -rf "$(CODEQL_DIR)"
