#!/usr/bin/env bash
# Copies the dev database `proact` (container proact-postgres) into the throwaway perf server
# (proact-perf-postgres, 127.0.0.1:5435) as `proact`, with the roles RLS needs. Read-only on the source.
set -euo pipefail
export MSYS_NO_PATHCONV=1
SRC=proact-postgres
DST=proact-perf-postgres

docker exec "$SRC" pg_dumpall -U postgres --roles-only \
  | grep -vE '^(CREATE|ALTER) ROLE postgres( |;)' \
  | docker exec -i "$DST" psql -U postgres -q -v ON_ERROR_STOP=1
docker exec "$DST" psql -U postgres -q -c 'DROP DATABASE IF EXISTS proact WITH (FORCE)' -c 'CREATE DATABASE proact'
docker exec "$SRC" pg_dump -U postgres -Fc proact \
  | docker exec -i "$DST" pg_restore -U postgres -d proact --no-owner --role=postgres
docker exec "$DST" psql -U postgres -d proact -q -c 'ANALYZE'
docker exec "$DST" psql -U postgres -d proact -At -c "SELECT 'tables=' || count(*) FROM pg_tables WHERE schemaname='public'"
