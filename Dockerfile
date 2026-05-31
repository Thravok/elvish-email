# elvishserver — production image (CockroachDB/Postgres + Valkey required unless ELVISH_ALLOW_EMPTY_DB=1).
# Build:  docker build -t elvish .
# Run:    docker run --rm -p 8765:8765 -e COCKROACH_DSN=... -e VALKEY_ADDR=... elvish
# Migrate: docker run --rm -e COCKROACH_DSN=... elvish -migrate
#
# Default listen :8765. Behind a proxy on another port, override CMD, e.g.:
#   docker run ... elvish -addr :8080 -root /app

# Pin minor line to match go.mod; patch releases track the official golang image.
ARG GO_VERSION=1.25

FROM golang:${GO_VERSION}-bookworm AS build
# Set automatically by BuildKit (docker build / buildx); falls back for legacy builders.
ARG TARGETARCH
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" \
	-o /out/elvishserver ./cmd/elvishserver

# Create data directory for runtime (MFA key storage, etc.)
# .keep ensures COPY works (Docker skips empty directories).
RUN mkdir -p /out/data && touch /out/data/.keep

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /out/elvishserver /usr/local/bin/elvishserver
COPY --chown=nonroot:nonroot content /app/content
COPY --chown=nonroot:nonroot static /app/static
COPY --chown=nonroot:nonroot templates /app/templates
COPY --from=build --chown=nonroot:nonroot /out/data /app/data

USER nonroot:nonroot
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD ["/usr/local/bin/elvishserver", "-root", "/app", "-addr", ":8765", "-healthcheck"]

ENTRYPOINT ["/usr/local/bin/elvishserver"]
CMD ["-addr", ":8765", "-root", "/app"]
