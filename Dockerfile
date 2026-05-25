# ELVish role binaries (api, mta, worker) — same image, different CMD per service.
# Build:  docker build -t elvish .
# API:    docker run ... elvishapi -addr :8765 -root /app
# MTA:    docker run ... elvishmta -root /app
# Worker: docker run ... elvishworker -root /app

ARG GO_VERSION=1.25

FROM golang:${GO_VERSION}-bookworm AS build
ARG TARGETARCH
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishapi ./cmd/elvishapi && \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishmta ./cmd/elvishmta && \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishworker ./cmd/elvishworker

RUN mkdir -p /out/data && touch /out/data/.keep

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /out/elvishapi /usr/local/bin/elvishapi
COPY --from=build --chown=nonroot:nonroot /out/elvishmta /usr/local/bin/elvishmta
COPY --from=build --chown=nonroot:nonroot /out/elvishworker /usr/local/bin/elvishworker
COPY --chown=nonroot:nonroot content /app/content
COPY --chown=nonroot:nonroot static /app/static
COPY --chown=nonroot:nonroot templates /app/templates
COPY --from=build --chown=nonroot:nonroot /out/data /app/data

USER nonroot:nonroot
EXPOSE 8765

ENTRYPOINT ["/usr/local/bin/elvishapi"]
CMD ["-addr", ":8765", "-root", "/app"]
