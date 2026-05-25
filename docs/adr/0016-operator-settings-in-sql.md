# ADR 0016: Operator settings in SQL

## Status

Accepted (2026-05)

## Context

`elvishserver` exposed dozens of `ELVISH_*` environment variables for product configuration (public URLs, CORS, registration policy, paid tier, DKIM selector/domain, uptime probes, etc.). Many duplicated settings already editable in the admin panel (`uptime_settings`, `admin_mail_settings`) or were documented but never implemented (`ELVISH_KEYSERVER_*`).

Operators had to redeploy to change routine product settings. Split-origin deploys required coordinating env vars across API and frontend containers.

## Decision

1. **Bootstrap env only** for connections, deployment role, SMTP listen addresses, secrets/paths, and dev/test gates (see README § Environment).
2. **`operator_settings` singleton table** (`id = 'default'`) for platform configuration: public base URL, mail domain, CORS origins, cookie domain, registration closed, paid features, trust forwarded-for, content cache TTL, SMTP rate limit.
3. **Admin panel → Platform** section (`GET/POST /api/admin/operator-settings`) is the source of truth after first boot.
4. **One-time import**: on first startup when `updated_at` is unset, legacy env vars are copied into `operator_settings` and logged; subsequent reads ignore those env vars.
5. **Remove env** for settings already in other admin tables: `ELVISH_DKIM_SELECTOR` / `ELVISH_DKIM_DOMAIN` (use `admin_mail_settings`), `ELVISH_UPTIME_*` (use `uptime_settings`), `ELVISH_ADMIN_EMAILS` (use `users.is_admin`).
6. **15s in-process cache** (`internal/operatorconfig`) for hot paths; invalidate on admin save.

## Consequences

- Coolify/compose files carry fewer `ELVISH_*` keys; operators configure product behavior in `/mail?view=admin#platform`.
- OIDC issuer wiring still happens at process start; changing public base URL in Platform updates mail links immediately but OIDC may require restart (documented in UI).
- Multi-replica API deployments may see up to 15s settings lag until a future Valkey pub/sub invalidation is added.

## References

- [README.md](../../README.md) § Environment
- [ADR 0015](0015-multi-service-deployment.md) — split-origin deploys
