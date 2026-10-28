#!/usr/bin/env bash
# End to end on a throwaway postgres:15-alpine container (forge-migrate-pg, 127.0.0.1:55434), as the
# restricted login forge_app (NOSUPERUSER CREATEDB CREATEROLE, plus the two superuser-only grants a DBA gives:
# BYPASSRLS and SET on app.tenant_ids): 00-create-db-and-roles.sh twice, 10-migrate.sh dry run / apply /
# re-run, the RLS role's table grants, pg_dump of the schema (as backup-forge.sh), and the refusal of an
# applied file that changed afterwards (on a copy of db/ passed as DB_DIR). Also: 00 as the superuser
# postgres and as a login whose database a DBA pre-created, and 00's refusals of a login without CREATEROLE,
# without the superuser-only grants, and of a wrong password. FORGE_TEST_EVIDENCE=<file> saves forge_app's
# 00 and 10 output.
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

# run <script> [args...]: sets rc and out (stdout + stderr) of a deploy/db script (env file $env_file).
env_file="$work/forge.env"
run() {
  local script="$1"
  shift
  rc=0
  out="$(DB_DIR="$work/db" bash "$deploy_db/$script" --env "$env_file" "$@" 2>&1)" || rc=$?
}

# write_env <file> <user> <password> <db>: an env file for the scratch container.
write_env() {
  printf '%s\n' "DB_CONTAINER=$container" "DB_USER=$2" "DB_PASSWORD=$3" "DB_NAME=$4" DB_SCHEMA=forge > "$1"
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
start_container
MSYS_NO_PATHCONV=1 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE ROLE forge_app LOGIN PASSWORD 'forge-app-pw' NOSUPERUSER CREATEDB CREATEROLE BYPASSRLS;
CREATE ROLE forge_nocr LOGIN PASSWORD 'forge-nocr-pw' NOSUPERUSER CREATEDB NOCREATEROLE;
CREATE ROLE forge_noset LOGIN PASSWORD 'forge-noset-pw' NOSUPERUSER CREATEDB CREATEROLE;
GRANT SET ON PARAMETER app.tenant_ids TO forge_app;
SQL

write_env "$work/nocr.env" forge_nocr forge-nocr-pw traverse_forge_nocr
env_file="$work/nocr.env"
run 00-create-db-and-roles.sh
check "bootstrap refuses a login without CREATEROLE" \
  "$([[ $rc -eq 1 && "$out" == *"forge_nocr lacks CREATEROLE"* ]] && echo true || echo false)"
write_env "$work/noset.env" forge_noset forge-noset-pw traverse_forge_noset
env_file="$work/noset.env"
run 00-create-db-and-roles.sh
check "bootstrap refuses a login without SET on app.tenant_ids and BYPASSRLS" "$([[ $rc -eq 1 && "$out" == \
  *"GRANT SET ON PARAMETER app.tenant_ids TO \"forge_noset\"; ALTER ROLE \"forge_noset\" BYPASSRLS;"* ]] \
  && echo true || echo false)"
write_env "$work/badpw.env" forge_app wrong-password traverse_forge
env_file="$work/badpw.env"
run 00-create-db-and-roles.sh
check "bootstrap refuses a wrong DB_PASSWORD before creating anything" \
  "$([[ $rc -eq 1 && "$out" == *"DB_PASSWORD rejected by $container for forge_app"* && "$out" != *"ok database"* ]] \
  && echo true || echo false)"

write_env "$work/forge.env" forge_app forge-app-pw traverse_forge
env_file="$work/forge.env"
run 00-create-db-and-roles.sh
echo "$out" > "$work/bootstrap-forge_app.txt"
check "bootstrap as forge_app checks rights and password" \
  "$([[ "$out" == *"ok login-rights (createdb+createrole)"* && "$out" == *"ok password"* ]] && echo true || echo false)"
check "bootstrap creates the database" "$(has "$out" 'ok database')"
check "bootstrap creates the role" "$(has "$out" 'ok role')"
check "bootstrap creates the schema" "$(has "$out" 'ok schema')"
check "bootstrap skips pg_stat_statements" "$(has "$out" 'skip: pg_stat_statements not')"
check "bootstrap grants the role, default privileges and ledger" \
  "$([[ "$out" == *"ok grant-role"* && "$out" == *"ok default-privileges"* && "$out" == *"ok ledger"* ]] \
  && echo true || echo false)"
check "pg_stat_statements is the last step" "$([[ "$(tail -1 <<<"$out")" == "skip: pg_stat_statements"* ]] \
  && echo true || echo false)"

run 00-create-db-and-roles.sh
steps="$(grep -v -e '^ok login-rights' -e '^ok password' <<<"$out")"
check "second bootstrap only skips" \
  "$([[ $rc -eq 0 && "$steps" != *"ok "* && "$steps" == *skip* ]] && echo true || echo false)"

run 10-migrate.sh --dry-run
check "dry run lists V001 and V002 to apply" \
  "$([[ "$out" == *"apply V001"* && "$out" == *"apply V002"* ]] && echo true || echo false)"

run 10-migrate.sh
echo "$out" > "$work/migrate-forge_app.txt"
check "migrate applies both files" "$(has "$(tail -1 <<<"$out")" 'migrations: applied 2, skipped 0')"
rows="$(sql 'SELECT count(*) FROM forge.migrations' 2>&1 || true)"
check "forge.migrations has 145 rows" "$([[ "$rows" == 145 ]] && echo true || echo false)"
idx="$(sql "SELECT count(*) FROM pg_indexes WHERE schemaname='forge' AND indexname LIKE 'IDX_%'" 2>&1 || true)"
check "forge has the FK indexes" "$([[ "$idx" =~ ^[0-9]+$ ]] && (( idx >= 34 )) && echo true || echo false)"
rls="$(sql "SET ROLE proact_rls_user; SET app.tenant_ids = ''; SELECT count(*) FROM forge.units;" 2>&1 || true)"
check "proact_rls_user reads forge.units" "$([[ "$rls" == 0 ]] && echo true || echo false)"
probe="$(sql "SET ROLE forge_app; CREATE TABLE forge.zz_probe(id int); RESET ROLE; SET ROLE proact_rls_user;
  SELECT count(*) FROM forge.zz_probe;" 2>&1 || true)"
sql 'DROP TABLE IF EXISTS forge.zz_probe;' >/dev/null 2>&1 || true
check "default privileges cover a table created after bootstrap" "$([[ "$probe" == 0 ]] && echo true || echo false)"

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
dump_rc=0
PGPASSWORD=forge-app-pw MSYS_NO_PATHCONV=1 docker exec -e PGPASSWORD "$container" \
  pg_dump -U forge_app -d traverse_forge -n forge -Fc -f /tmp/forge.dump >/dev/null 2>&1 || dump_rc=$?
check "forge_app can pg_dump the schema, as backup-forge.sh does (exit $dump_rc)" \
  "$([[ $dump_rc -eq 0 ]] && echo true || echo false)"
owner="$(sql "SELECT tableowner FROM pg_tables WHERE schemaname = 'forge' AND tablename = 'units'" 2>&1 || true)"
check "forge tables are owned by forge_app" "$([[ "$owner" == forge_app ]] && echo true || echo false)"

MSYS_NO_PATHCONV=1 docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE DATABASE traverse_forge_nocr OWNER forge_nocr;
GRANT proact_rls_user TO forge_nocr;
GRANT SET ON PARAMETER app.tenant_ids TO forge_nocr;
ALTER ROLE forge_nocr BYPASSRLS;
SQL
env_file="$work/nocr.env"
run 00-create-db-and-roles.sh
check "bootstrap accepts a login whose database and role a DBA pre-created (exit $rc)" \
  "$([[ $rc -eq 0 && "$out" == *"ok login-rights (pre-created by a DBA)"* && "$out" == *"ok ledger"* ]] \
  && echo true || echo false)"
write_env "$work/su.env" postgres postgres traverse_forge_su
env_file="$work/su.env"
run 00-create-db-and-roles.sh
check "bootstrap as superuser (exit $rc)" "$([[ $rc -eq 0 && "$out" == *"ok login-rights (superuser)"* \
  && "$out" == *"ok ledger"* ]] && echo true || echo false)"

if [[ -n "${FORGE_TEST_EVIDENCE:-}" ]]; then
  cat "$work/bootstrap-forge_app.txt" "$work/migrate-forge_app.txt" > "$FORGE_TEST_EVIDENCE"
fi
total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
