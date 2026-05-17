#!/bin/sh
# Wait until Scylla accepts CQL on 9042, then apply schema (idempotent).
# nodetool "UN" can appear before native_transport is ready; this avoids flaky db-up.
set -e
host="${SCYLLA_HOST:-scylla}"
schema="${SCYLLA_SCHEMA:-/schema.cql}"
max_attempts="${SCYLLA_INIT_MAX_ATTEMPTS:-90}"
sleep_s="${SCYLLA_INIT_SLEEP_SEC:-2}"

i=0
while [ "$i" -lt "$max_attempts" ]; do
	if cqlsh "$host" -e 'SELECT cluster_name FROM system.local LIMIT 1' >/dev/null 2>&1; then
		break
	fi
	i=$((i + 1))
	echo "scylla-init: waiting for CQL on ${host} (${i}/${max_attempts})..."
	sleep "$sleep_s"
done

if ! cqlsh "$host" -e 'SELECT cluster_name FROM system.local LIMIT 1' >/dev/null 2>&1; then
	echo "scylla-init: timeout — CQL never became reachable on ${host}"
	exit 1
fi

cqlsh "$host" -f "$schema"
echo "scylla-init: applied ${schema}"
