ARG GO_VERSION=1.25
FROM node:22-bookworm AS static
WORKDIR /src
COPY apps/web ./apps/web
COPY apps/admin ./apps/admin
COPY packages ./packages
COPY services/api/static ./services/api/static
RUN cd apps/web/frontend && npm ci && node build.mjs \
	&& node apps/admin/frontend/build.mjs \
	&& mkdir -p apps/web/shared apps/admin/shared \
	&& cp packages/elvish-client/src/api-config.js packages/elvish-client/src/api-fetch.js apps/web/shared/ \
	&& cp packages/elvish-client/src/api-config.js packages/elvish-client/src/api-fetch.js apps/admin/shared/ \
	&& cp packages/elvish-ui/src/shared.css apps/web/shared/shared.css \
	&& cp services/api/static/perf.js apps/web/perf.js

FROM golang:${GO_VERSION}-bookworm AS build
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
COPY libs ./libs
COPY services ./services
COPY tools ./tools
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishapi ./services/api/cmd/elvishapi

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/elvishapi /usr/local/bin/elvishapi
COPY --from=static --chown=nonroot:nonroot /src/apps/web /app/apps/web
COPY --from=static --chown=nonroot:nonroot /src/apps/admin /app/apps/admin
COPY --chown=nonroot:nonroot services/api/templates /app/services/api/templates
COPY --chown=nonroot:nonroot services/api/content /app/services/api/content
COPY --chown=nonroot:nonroot services/api/static /app/services/api/static
ENV ELVISH_SERVE_STATIC=1
ENV ELVISH_MONOLITH=1
USER nonroot:nonroot
EXPOSE 8765 25 587
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
	CMD ["/usr/local/bin/elvishapi", "-root", "/app", "-addr", ":8765", "-healthcheck"]
ENTRYPOINT ["/usr/local/bin/elvishapi"]
CMD ["-addr", ":8765", "-root", "/app"]
