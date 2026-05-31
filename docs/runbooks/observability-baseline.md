# Observability baseline

Minimum cross-tier tracing hooks on the `rewrite` layout:

- **Request ID** — `X-Request-ID` on every api response (`libs/go/httpserver/requestid.go`); propagate from clients when possible.
- **Health** — `GET /api/healthz` on api and mail-mta (internal HTTP); `GET /healthz` on web/admin/docs nginx images; worker/mta `-healthcheck` for Docker probes.
- **Logs** — structured JSON from Go services; no session tokens or mail bodies.

Future: OpenTelemetry export from api/worker/mta (see platform roadmap in monorepo plan).
