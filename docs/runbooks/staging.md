# Staging profile

Use Docker Compose **`staging`** profile to run the full split stack locally without production secrets:

```bash
docker compose --profile staging up -d --build
```

Services: **api** (`ELVISH_SERVE_STATIC=1`), **mail-mta**, **worker**, plus **cockroach**, **valkey**, **scylla**, **minio**. Optional: **web** / **admin** with profile `split-origin`.

Set `ELVISH_COOKIE_DOMAIN` only when testing cross-subdomain cookies; for localhost, use published ports in [split-deploy.md](split-deploy.md).
