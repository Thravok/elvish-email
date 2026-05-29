#!/usr/bin/env bash
# Forbid cross-service internal imports (monorepo boundary).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail=0
while IFS= read -r f; do
  echo "cross-service internal import: $f"
  fail=1
done < <(grep -RIn --include='*.go' 'elvish/services/[^/]*/internal' libs/go services tools 2>/dev/null || true)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "import boundaries OK"
