# ADR 0001: Primary durable store is CockroachDB/Postgres (SQL)

## Status

Accepted (historical Mongo-only ADR removed from the repo; SQL is the single durable store).

## Context

Elvish previously used MongoDB for posts, users, PGP keys, site config, uptime persistence, and mail metadata. Mail and outbox workloads benefit from relational constraints, transactions (for example outbox leasing), and straightforward reporting in SQL.

## Decision

Use **CockroachDB** (or any **Postgres wire–compatible** database) as the **single system of record** for durable application data. Implement persistence with **`github.com/jackc/pgx/v5`** and **versioned SQL migrations** (`internal/db/migrations`, applied via **goose** at process startup).

**Valkey** remains for ephemeral data: HTTP sessions, rate limits, and uptime snapshot buffers.

## Consequences

- Positive: one SQL schema, transactional outbox, `UUID` primary keys, simpler invariants than document `$inc` patterns for aggregates.
- Operational: local dev uses Docker Compose Cockroach single-node + Redis; production sets `COCKROACH_DSN` (TLS parameters as required).

## Migration from legacy Mongo

The in-repo **Mongo → SQL one-off tool was removed** (no production deployments depended on it). Historical installs should export from Mongo and import via ad-hoc SQL or a private fork of the old migrator. Goose migration `00002_drop_legacy_mongo_user_map.sql` drops the unused `legacy_mongo_user_map` table after bootstrap.
