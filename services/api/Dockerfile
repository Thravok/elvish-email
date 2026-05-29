ARG GO_VERSION=1.25
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
COPY --chown=nonroot:nonroot services/api/templates /app/services/api/templates
COPY --chown=nonroot:nonroot services/api/content /app/services/api/content
COPY --chown=nonroot:nonroot services/api/static /app/services/api/static
ENV ELVISH_SERVE_STATIC=0
USER nonroot:nonroot
EXPOSE 8765
ENTRYPOINT ["/usr/local/bin/elvishapi"]
CMD ["-addr", ":8765", "-root", "/app"]
