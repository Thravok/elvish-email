# Console service cutover

ELVish Console runs as a separate service (`elvishconsole`, Docker service `console`) on port **8080** (dev: **8780**).

## First deploy

1. Set `ELVISH_CONSOLE_VAULT_KEY` (base64-encoded 32-byte key) in production.
2. Set `ELVISH_STAFF_BOOTSTRAP_EMAILS` and `ELVISH_STAFF_BOOTSTRAP_PASSWORD` before first boot (or create staff via SQL).
3. Assign a Coolify domain on `console` (port 8080), e.g. `https://console.example.com:8080`.
4. Set `ELVISH_CONSOLE_PUBLIC_URL` on the `api` service so `/admin/` redirects to Console.

## Migrate operators

1. Create staff accounts in Console (super_admin can use `/api/staff/users`).
2. Stop granting new platform `users.is_admin` via `ELVISH_ADMIN_EMAILS`.
3. Leave `ELVISH_LEGACY_CONSOLE=0` (default) on `api` so `/api/admin/*` returns 404 on the public domain.

## Support inbox

1. Provision a platform user for `support@yourdomain` per [support-mailbox.md](support-mailbox.md).
2. In Console (super_admin): `PUT /api/support/config` with `platform_user_id` and `primary_address`.
3. Import escrow keys: `PUT /api/support/vault` with `account_key_json` and `identity_keys_json` (see ADR 0018).
4. Support agents use **Support Inbox** section or `/api/support/inbox`.

## Local dev

```bash
make db-up
make dev-console   # http://127.0.0.1:8780
```

Default bootstrap (when no staff rows exist): email from `ELVISH_STAFF_BOOTSTRAP_EMAILS`, password from `ELVISH_STAFF_BOOTSTRAP_PASSWORD`.
