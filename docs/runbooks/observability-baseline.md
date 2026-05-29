# Observability baseline

Minimum cross-tier tracing hooks on the `rewrite` layout:

- **Request ID** — `X-Request-ID` on every api response (`libs/go/httpserver/requestid.go`); propagate from clients when possible.
- **Health** — `GET /health` on api; `GET /healthz` on web/admin nginx images.
- **Logs** — structured JSON from Go services; no session tokens or mail bodies.

Future: OpenTelemetry export from api/worker/mta (see platform roadmap in monorepo plan).
