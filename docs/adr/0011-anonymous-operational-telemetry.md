# ADR 0011 — Anonymous operational telemetry

**Status:** Accepted (2026-05)  
**Related:** [0004 — Per-field metadata consent](./0004-per-field-metadata-consent.md), [0007 — Four-store mail architecture](./0007-four-store-mail-architecture.md)

## Context

Elvish needs feedback loops for reliability and performance, but the product posture is strongly privacy-preserving. The telemetry system must help operators improve delivery health, uptime, and server behaviour without collecting anything that can identify or track a person, account, device, message, or host.

The explicit requirements for this subsystem are:

- telemetry is **opt-in**
- telemetry is **self-hosted**
- telemetry is **anonymous**
- telemetry stores **no unique identifiers**
- export is **manual only**

That rules out traditional event streams and third-party analytics SDKs. It also rules out storing raw routes, domains, recipient addresses, message IDs, IPs, user agents, or any stable pseudonymous token.

## Decision

Implement anonymous operational telemetry as **hourly SQL rollups only**.

### Data model

Use CockroachDB/Postgres as the durable store:

- `telemetry_settings` — singleton operator settings
- `telemetry_rollups_hourly` — aggregate rows keyed by:
  - `bucket_start`
  - `metric_name`
  - `feature_area`
  - `result`
  - `status_class`
  - `transport`

Each row stores only aggregate measures:

- `count`
- `sum_ms`
- `min_ms`
- `max_ms`

### Allowed sources

Phase one may record only coarse operational outcomes from:

- HTTP request route groups
- mail ingest outcomes
- outbound delivery outcomes
- SMTP auth / lookup / accept / submission outcomes
- background job runtimes

### Privacy contract

The telemetry schema and validation layer must reject any attempt to persist:

- `user_id`, `session_id`, email addresses, usernames
- IPs, forwarded IPs, user agents
- raw URLs, hostnames, domains, recipient lists
- message IDs, blob refs, ciphertext hashes, tokens
- arbitrary free-form labels or JSON dimensions

Only fixed allowlisted enums are permitted for dimensions.

### Export

Exports are generated manually by an admin and contain only:

- current telemetry settings
- bounded summary rollups
- bounded hourly rollups

No background upload exists in phase one.

## Consequences

- The telemetry subsystem is easy to audit because the persisted schema is explicit and low-cardinality.
- Operators gain local reliability insight without introducing a tracking identifier.
- Telemetry is useful for trend analysis, not for user journey reconstruction.
- The product copy must stop saying "no telemetry" and instead say "no telemetry by default" plus explain the anonymous aggregate-only model.

## Rejected alternatives

- **Raw event logs in SQL or Scylla** — too easy to smuggle linkable identifiers into the dataset.
- **Third-party analytics or tracing backends** — conflicts with self-hosting and the privacy contract.
- **Hashed identifiers** — still stable identifiers, which violates the requirement.
- **Arbitrary labels JSON** — harder to audit and easier to misuse than explicit columns.
