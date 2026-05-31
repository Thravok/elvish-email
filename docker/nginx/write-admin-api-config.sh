#!/bin/sh
# Write admin api-config.js from env before nginx starts (Coolify / pre-built GHCR images).
set -eu
mkdir -p /usr/share/nginx/html/shared
printf '%s\n' \
  "window.__ELVISH_API_BASE__='${ELVISH_API_BASE:-}';" \
  > /usr/share/nginx/html/shared/api-config.js
nginx -t
exec nginx -g 'daemon off;'
