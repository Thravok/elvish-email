# Staging profile

Use Docker Compose **`staging`** profile to run the full split stack locally without production secrets:

```bash
docker compose --profile staging up -d --build
```

Services: **api** only (`ELVISH_MONOLITH=1`, `ELVISH_SERVE_STATIC=1`), plus **cockroach**, **valkey**, **scylla**, **minio**. Optional profiles: `split-origin`, `split-roles`.

Set `ELVISH_COOKIE_DOMAIN` only when testing cross-subdomain cookies; for localhost, use published ports in [split-deploy.md](split-deploy.md).
