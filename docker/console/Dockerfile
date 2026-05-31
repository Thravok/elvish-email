# elvishconsole — ELVish Console operator service.
ARG GO_VERSION=1.25

FROM golang:${GO_VERSION}-bookworm AS build
ARG TARGETARCH
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" \
	-o /out/elvishconsole ./cmd/elvishconsole

RUN mkdir -p /out/data && touch /out/data/.keep

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /out/elvishconsole /usr/local/bin/elvishconsole
COPY --chown=nonroot:nonroot content /app/content
COPY --chown=nonroot:nonroot static /app/static
COPY --from=build --chown=nonroot:nonroot /out/data /app/data

USER nonroot:nonroot
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["/usr/local/bin/elvishconsole", "-root", "/app", "-addr", ":8080", "-healthcheck"]

ENTRYPOINT ["/usr/local/bin/elvishconsole"]
CMD ["-addr", ":8080", "-root", "/app"]
