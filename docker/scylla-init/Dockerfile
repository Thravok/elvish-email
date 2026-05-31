# One-shot Scylla schema apply (Coolify / GHCR). Same CQL + cqlsh as scylladb/scylla:5.4.
FROM scylladb/scylla:5.4
COPY libs/go/scyllastore/schema.cql /schema.cql
COPY docker/scylla-init.sh /scylla-init.sh
RUN chmod +x /scylla-init.sh
ENTRYPOINT ["sh", "/scylla-init.sh"]
