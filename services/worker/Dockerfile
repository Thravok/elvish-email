ARG GO_VERSION=1.25
FROM golang:${GO_VERSION}-bookworm AS build
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
COPY libs ./libs
COPY services ./services
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishworker ./services/worker/cmd/elvishworker
RUN mkdir -p /out/data && touch /out/data/.keep

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/elvishworker /usr/local/bin/elvishworker
COPY --from=build --chown=nonroot:nonroot /out/data /app/data
USER nonroot:nonroot
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
	CMD ["/usr/local/bin/elvishworker", "-root", "/app", "-healthcheck"]
ENTRYPOINT ["/usr/local/bin/elvishworker"]
CMD ["-root", "/app"]
