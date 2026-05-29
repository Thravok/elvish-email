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

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/elvishworker /usr/local/bin/elvishworker
RUN mkdir -p /app/data && touch /app/data/.keep
USER nonroot:nonroot
ENTRYPOINT ["/usr/local/bin/elvishworker"]
CMD ["-root", "/app"]
