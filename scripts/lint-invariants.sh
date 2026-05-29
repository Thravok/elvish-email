#!/usr/bin/env sh
# Repo invariants enforced by make lint and GitLab lint-golangci. See ADR 0008 and 0009.
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$root"

# ADR 0008: no server-side body-search API route.
if grep -RIn --include='*.go' --exclude='*_test.go' '"[^"]*search/body' libs/go/httpserver/ 2>/dev/null; then
  printf '%s\n' "ERROR: forbidden body-search route detected — see ADR 0008"
  exit 1
fi

# ADR 0009: protected-link password (Mode B) must not appear in server code paths.
if grep -RIn --include='*.go' -E '"(password|kek_b64|recipient_password|sender_password)"' \
  libs/go/httpserver/api_protected_links.go libs/go/maillinks/ libs/go/relaykey/ 2>/dev/null; then
  printf '%s\n' "ERROR: protected-link password leaked into server code — see ADR 0009"
  exit 1
fi
