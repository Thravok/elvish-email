#!/bin/sh
set -eu
out="/usr/share/nginx/html/shared/api-config.js"
base="${ELVISH_API_PUBLIC_URL:-}"
# Escape backslashes and double quotes for a JS string literal.
escaped=$(printf '%s' "$base" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '%s\n' "// Generated at container start from ELVISH_API_PUBLIC_URL." >"$out"
printf '%s\n' "window.__ELVISH_API_BASE__ = \"$escaped\";" >>"$out"
