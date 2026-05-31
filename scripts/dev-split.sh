#!/usr/bin/env bash
# Fallback when overmind is not installed: run monolith api in background.
set -euo pipefail
root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$root"

pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

make -s db-up
make -s dev-api-once &
pids+=($!)

printf '%s\n' \
  "Dev running (PID ${pids[*]})" \
  "  API:    http://127.0.0.1:8765 (HTTP + SMTP + outbox)" \
  "  SMTP:   localhost:2525 / :2587" \
  "Ctrl+C to stop"

wait
