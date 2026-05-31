# Nginx reverse proxy + static asset layer for local development.
# Build context must be the repository root (see docker-compose.yml).

FROM nginx:1.27-alpine

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY static/ /usr/share/nginx/html/

EXPOSE 80
