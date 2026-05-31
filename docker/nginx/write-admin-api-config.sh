#!/bin/sh
# Write admin api-config.js from env before nginx starts (Coolify / pre-built GHCR images).
set -eu
printf '%s\n' \
  "window.__ELVISH_API_BASE__='${ELVISH_API_BASE:-}';" \
  > /usr/share/nginx/html/shared/api-config.js
exec nginx -g 'daemon off;'
