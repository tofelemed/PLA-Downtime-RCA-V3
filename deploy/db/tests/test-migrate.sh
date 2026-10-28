#!/usr/bin/env bash
# End to end on a throwaway postgres:15-alpine container (forge-migrate-pg, 127.0.0.1:55434):
# 00-create-db-and-roles.sh twice, 10-migrate.sh dry run / apply / re-run, the RLS role's table grants,
# and the refusal of an applied file that changed afterwards (on a copy of db/ passed as DB_DIR).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_db="$here/.."
repo_root="$(cd "$here/../../.." && pwd)"
container=forge-migrate-pg
port=55434
work="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

passed=0
failed=0

check() {
  if [[ "$2" == true ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "not ok: $1" >&2
  fi
}

# has <haystack> <needle>: "true" when the text contains the fixed string.
has() {
  if [[ "$1" == *"$2"* ]]; then echo true; else echo false; fi
}

# sql <statements>: last output line of the statements in traverse_forge, run as postgres in the container.
sql() {
  MSYS_NO_PATHCONV=1 docker exec -i "$container" psql -X -q -At -v ON_ERROR_STOP=1 -U postgres \
    -d traverse_forge <<<"$1" | tail -1
}

# run <script> [args...]: sets rc and out (stdout + stderr) of a deploy/db script.
run() {
  local script="$1"
  shift
  rc=0
  out="$(DB_DIR="$work/db" bash "$deploy_db/$script" --env "$work/forge.env" "$@" 2>&1)" || rc=$?
}

start_container() {
  local tries=0
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres \
    -p "127.0.0.1:$port:5432" postgres:15-alpine >/dev/null
  until MSYS_NO_PATHCONV=1 docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres; do
    tries=$((tries + 1))
    (( tries < 60 )) || { echo "FAIL: $container did not become ready" >&2; exit 1; }
    sleep 1
  done
}

cp -r "$repo_root/db" "$work/db"
printf '%s\n' "DB_CONTAINER=$container" DB_USER=postgres DB_PASSWORD=postgres DB_NAME=traverse_forge \
  DB_SCHEMA=forge > "$work/forge.env"
start_container

run 00-create-db-and-roles.sh
check "bootstrap creates the database" "$(has "$out" 'ok database')"
check "bootstrap creates the role" "$(has "$out" 'ok role')"
check "bootstrap creates the schema" "$(has "$out" 'ok schema')"
check "bootstrap skips pg_stat_statements" "$(has "$out" 'skip: pg_stat_statements not preloaded')"

run 00-create-db-and-roles.sh
check "second bootstrap only skips" \
  "$([[ $rc -eq 0 && "$out" != *"ok "* && "$out" == *skip* ]] && echo true || echo false)"

run 10-migrate.sh --dry-run
check "dry run lists V001 and V002 to apply" \
  "$([[ "$out" == *"apply V001"* && "$out" == *"apply V002"* ]] && echo true || echo false)"

run 10-migrate.sh
check "migrate applies both files" "$(has "$(tail -1 <<<"$out")" 'migrations: applied 2, skipped 0')"
rows="$(sql 'SELECT count(*) FROM forge.migrations' 2>&1 || true)"
check "forge.migrations has 145 rows" "$([[ "$rows" == 145 ]] && echo true || echo false)"
idx="$(sql "SELECT count(*) FROM pg_indexes WHERE schemaname='forge' AND indexname LIKE 'IDX_%'" 2>&1 || true)"
check "forge has the FK indexes" "$([[ "$idx" =~ ^[0-9]+$ ]] && (( idx >= 34 )) && echo true || echo false)"
rls="$(sql "SET ROLE proact_rls_user; SET app.tenant_ids = ''; SELECT count(*) FROM forge.units;" 2>&1 || true)"
check "proact_rls_user reads forge.units" "$([[ "$rls" == 0 ]] && echo true || echo false)"

run 10-migrate.sh
check "second migrate skips both files" "$(has "$(tail -1 <<<"$out")" 'migrations: applied 0, skipped 2')"

sed -i 's/IDX_approved_loss_lines_revision_id/IDX_tampered/' "$work/db/migrations/V002__fk_indexes.sql" \
  2>/dev/null || true
DB_DIR="$work/db" bash "$deploy_db/checksums.sh" >/dev/null 2>&1 || true
run 10-migrate.sh
check "refuses a tampered applied file" \
  "$([[ $rc -eq 1 && "$out" == *"V002 was applied with checksum"* ]] && echo true || echo false)"
ledger="$(sql 'SELECT count(*) FROM forge.deploy_migrations' 2>&1 || true)"
check "ledger unchanged after the refusal" "$([[ "$ledger" == 2 ]] && echo true || echo false)"

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
