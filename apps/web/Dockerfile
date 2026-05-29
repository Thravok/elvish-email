FROM nginx:1.27-alpine
ARG ELVISH_API_BASE=
ARG ELVISH_ADMIN_ORIGIN=
COPY apps/web /usr/share/nginx/html
RUN printf '%s\n' \
  "window.__ELVISH_API_BASE__='${ELVISH_API_BASE}';" \
  "window.__ELVISH_ADMIN_ORIGIN__='${ELVISH_ADMIN_ORIGIN}';" \
  > /usr/share/nginx/html/shared/api-config.js
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
