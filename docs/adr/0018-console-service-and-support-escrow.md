# ADR 0018: Console service and support key escrow

## Status

Proposed (2026-05)

## Context

Operator tooling (user management, uptime, telemetry, system mail, domain admin) is embedded in `elvishserver` and gated by `users.is_admin` with the same session cookie as mail customers. Support inbound mail requires a dedicated platform user with shared credentials; there is no multi-staff inbox or RBAC.

Operators need:

1. A **Console** surface isolated from the public mail domain
2. **Staff accounts** separate from platform users
3. **Role-based access** (super_admin, operator, support_agent)
4. A **shared support inbox** where multiple staff can read and reply without sharing one password

## Decision

1. **`elvishconsole` service** — separate Go binary and Docker container (`console`) on port 8080, served at a dedicated origin (e.g. `console.example.com`).
2. **Staff identity** — `staff_users` table with bcrypt passwords, optional TOTP, Valkey sessions (`elvish_console_session`, prefix `elvish:console:sess:`). No linkage to `users` rows required for Console login.
3. **RBAC** — roles: `super_admin` (full access + staff CRUD), `operator` (platform admin APIs), `support_agent` (support inbox only, plus auth).
4. **API surface** — platform operator endpoints move from `/api/admin/*` on `elvishserver` to `/api/console/*` on Console. Legacy routes on the monolith are removed after cutover (`ELVISH_LEGACY_CONSOLE=0`).
5. **Support key escrow** — for one configured support platform user, Console stores account/identity private keys encrypted at rest with `ELVISH_CONSOLE_VAULT_KEY` (AES-GCM). Staff with inbox permission can read/decrypt support mail server-side; all decrypt/reply actions are audit-logged in `staff_audit_log`.
6. **Scope limit** — escrow applies **only** to the configured support mailbox. All other user mail remains client-side E2EE per ADR 0005.

## Consequences

- Console operators can decrypt support mailbox bodies; this is an intentional, documented exception to zero-access for that mailbox only.
- `ELVISH_CONSOLE_VAULT_KEY` is a critical secret; rotation requires re-importing support keys.
- Two session cookies coexist during migration; production should use separate domains and `COOKIE_SECURE=1`.
- `users.is_admin` is deprecated for new deployments; staff accounts replace platform-user admin grants.
- Console needs read/write access to Cockroach, Valkey, Scylla, and blob storage for platform ops and support inbox.

## References

- [docs/runbooks/support-mailbox.md](../runbooks/support-mailbox.md)
- [ADR 0005](0005-account-key-hierarchy.md) — account/identity key hierarchy
- [ADR 0016](0016-operator-settings-in-sql.md) — operator settings in SQL
