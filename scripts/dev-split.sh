#!/usr/bin/env bash
# Fallback when overmind is not installed: run api, web, admin, mta, worker in background.
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
make -s dev-web-once &
pids+=($!)
make -s dev-admin-once &
pids+=($!)
make -s dev-mta-once &
pids+=($!)
make -s dev-worker-once &
pids+=($!)

printf '%s\n' \
  "Split dev running (PID ${pids[*]})" \
  "  API:    http://127.0.0.1:8765" \
  "  Web:    http://127.0.0.1:8081" \
  "  Admin:  http://127.0.0.1:8082" \
  "  SMTP:   localhost:2525 / :2587" \
  "Ctrl+C to stop all"

wait
