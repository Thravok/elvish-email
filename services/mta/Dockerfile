ARG GO_VERSION=1.25
FROM golang:${GO_VERSION}-bookworm AS build
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
COPY libs ./libs
COPY services ./services
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH:-amd64}" \
	go build -buildvcs=false -trimpath -ldflags="-s -w" -o /out/elvishmta ./services/mta/cmd/elvishmta
RUN mkdir -p /out/data && touch /out/data/.keep

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/elvishmta /usr/local/bin/elvishmta
COPY --from=build --chown=nonroot:nonroot /out/data /app/data
USER nonroot:nonroot
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
	CMD ["/usr/local/bin/elvishmta", "-addr", ":8765", "-root", "/app", "-healthcheck"]
ENTRYPOINT ["/usr/local/bin/elvishmta"]
CMD ["-addr", ":8765", "-root", "/app"]
