#!/usr/bin/env bash
# Validate docker-compose.coolify.yaml with stock Docker Compose.
# Coolify-only fields (exclude_from_hc) are stripped — Coolify removes them before deploy too.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${ROOT}/docker-compose.coolify.yaml"

export COOKIE_SECURE="${COOKIE_SECURE:-1}"
export SERVICE_URL_WEB_8080="${SERVICE_URL_WEB_8080:-http://localhost:8080}"
export SERVICE_URL_ADMIN_8080="${SERVICE_URL_ADMIN_8080:-http://localhost:8081}"
export SERVICE_URL_API_8765="${SERVICE_URL_API_8765:-http://localhost:8765}"
export SERVICE_FQDN_WEB="${SERVICE_FQDN_WEB:-localhost}"
export SERVICE_FQDN_ADMIN="${SERVICE_FQDN_ADMIN:-localhost}"
export SERVICE_FQDN_API="${SERVICE_FQDN_API:-localhost}"
export SERVICE_PASSWORD_64_VALKEY="${SERVICE_PASSWORD_64_VALKEY:-local-valkey-pass}"
export SERVICE_USER_MINIO="${SERVICE_USER_MINIO:-minio}"
export SERVICE_PASSWORD_64_MINIO="${SERVICE_PASSWORD_64_MINIO:-local-minio-secret}"
export SERVICE_BASE64_64="${SERVICE_BASE64_64:-dGVzdG1mYQ==}"

sed '/^[[:space:]]*exclude_from_hc:/d' "${COMPOSE_FILE}" \
  | docker compose -f - config --quiet

printf '%s\n' "docker-compose.coolify.yaml: OK"
