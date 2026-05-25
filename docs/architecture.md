# Architecture overview

**ELVish** ships as the Go binary **`elvishserver`** (module **`elvish`**), deployable as one process or split into **API**, **frontend** (nginx + static), and **mail-mta** (SMTP + workers) via `ELVISH_COMPONENT` — see [ADR 0015](adr/0015-multi-service-deployment.md). This page is a map; authoritative decisions live in [adr/](adr/) and [e2ee-mail-spec.md](e2ee-mail-spec.md).

## Narrative

1. **Browsers** talk to `elvishserver` over HTTPS (or local HTTP in development). The **mail** client (`static/mail/`) is the primary app shell; the **operator panel** is embedded in mail at `/mail?view=admin` via `static/dist/mail-admin-embed.js`. Shared admin section modules live under `static/admin/`. Legacy `/admin/` URLs redirect into mail.
2. **CockroachDB** (or any Postgres-compatible server on the same wire protocol) is the **system of record**: users, blog posts, mail settings, outbox rows, identity metadata, and relational invariants. Migrations live in `internal/db/migrations/` and run at startup when `COCKROACH_DSN` is set.
3. **Valkey** (Redis-compatible) holds **ephemeral** data: HTTP sessions, rate-limit counters, and short-lived negative caches used by the mail keyserver path.
4. **Mail at scale** splits hot paths across **ScyllaDB** (mailbox-scale projections and time-ordered access) and **S3-compatible object storage** (ciphertext blobs). See [ADR 0007](adr/0007-four-store-mail-architecture.md). Local development uses Docker Compose for all of these; production sets the same env vars explicitly.
5. **SMTP** receive and submission, outbound delivery, and **DKIM** signing are implemented in-tree (`internal/smtp/`, `internal/dkim/`, workers) per [ADR 0006](adr/0006-own-smtp-stack.md). Listeners are optional and controlled by env (see root README).
6. **Native iOS** and **Flutter Android** use the same HTTP API and session cookies as the browser (`IOS/`, `flutter/elvish_mail/`). Mobile compose implements **PGP direct** and **protected-link** send modes aligned with [`static/mail/compose.jsx`](../static/mail/compose.jsx) (see [IOS/README.md](../IOS/README.md), [flutter/elvish_mail/README.md](../flutter/elvish_mail/README.md)).

## Diagram

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser[Browser]
    IOSapp[iOS_app]
    FlutterApp[Flutter_Android]
  end
  subgraph edge [Deployable_tiers]
    FE[frontend_nginx]
    API[api_elvishserver]
    MTA[mail_mta_elvishserver]
  end
  SQL[(Cockroach_or_Postgres)]
  Valkey[(Valkey)]
  Scylla[(ScyllaDB)]
  Blobs[(S3_object_store)]
  subgraph external [External_mail]
    PeerMX[Recipient_MX_hosts]
  end
  Browser --> FE
  Browser -->|credentialed_API| API
  FE -->|SSR_proxy| API
  IOSapp --> API
  FlutterApp --> API
  InternetMX[Internet_MX] --> MTA
  MTA --> PeerMX
  API --> SQL
  API --> Valkey
  MTA --> SQL
  API --> Scylla
  API --> Blobs
  MTA --> Scylla
  MTA --> Blobs
```

Edges are simplified: some read paths hit only SQL; blob and Scylla usage follow the four-store split in ADR 0007. For telemetry rollups only, see [ADR 0011](adr/0011-anonymous-operational-telemetry.md).

## Related reading

- [README.md](../README.md) — runbooks and environment variables
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Make targets and code layout
- [adr/README.md](adr/README.md) — full ADR index
