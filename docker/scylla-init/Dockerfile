# One-shot Scylla schema apply (Coolify / GHCR).
FROM scylladb/scylla:5.4
COPY internal/scyllastore/schema.cql /schema.cql
COPY docker/scylla-init.sh /scylla-init.sh
RUN chmod +x /scylla-init.sh
ENTRYPOINT ["sh", "/scylla-init.sh"]
