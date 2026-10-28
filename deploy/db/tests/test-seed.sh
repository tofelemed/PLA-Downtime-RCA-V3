#!/usr/bin/env bash
# End to end on a throwaway postgres:15-alpine container (forge-seed-pg, 127.0.0.1:55435):
# 00-create-db-and-roles.sh, 10-migrate.sh, 20-seed-reference.sh --with-users twice, then spot checks of
# the seeded HDPE-TRAIN plant and of row-level security. Needs the git-ignored
# db/seed/generated/U010__users.sql from extract-reference-from-dev.sh.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_db="$here/.."
repo_root="$(cd "$here/../../.." && pwd)"
container=forge-seed-pg
port=55435
work="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

passed=0
failed=0

# check <name> <actual> <expected>
check() {
  if [[ "$2" == "$3" ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "not ok: $1 (got '$2', want '$3')" >&2
  fi
}

# sql <statements>: output of the statements in traverse_forge (rows joined by ','), run as postgres.
sql() {
  MSYS_NO_PATHCONV=1 docker exec -i "$container" psql -X -q -At -v ON_ERROR_STOP=1 -U postgres \
    -d traverse_forge <<<"$1" | paste -sd, -
}

# run <script> [args...]: sets rc and out (stdout + stderr) of a deploy/db script.
run() {
  local script="$1"
  shift
  rc=0
  out="$(DB_DIR="$work/db" bash "$deploy_db/$script" --env "$work/forge.env" "$@" 2>&1)" || rc=$?
}

# must <step>: stop the test when the last run failed.
must() {
  if [[ $rc -ne 0 ]]; then
    echo "$out" >&2
    echo "FAIL: $1 exited $rc" >&2
    exit 1
  fi
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

[[ -f "$repo_root/db/seed/generated/U010__users.sql" ]] ||
  { echo "FAIL: db/seed/generated/U010__users.sql missing; run deploy/db/extract-reference-from-dev.sh" >&2; exit 1; }
tenant_id="$(sed -n 's/.*"tenantId": "\([0-9a-f-]*\)".*/\1/p' "$repo_root/db/seed/manifest.json")"
cp -r "$repo_root/db" "$work/db"
printf '%s\n' "DB_CONTAINER=$container" DB_USER=postgres DB_PASSWORD=postgres DB_NAME=traverse_forge \
  DB_SCHEMA=forge > "$work/forge.env"
start_container

run 00-create-db-and-roles.sh
must 00-create-db-and-roles.sh
run 10-migrate.sh
must 10-migrate.sh
run 20-seed-reference.sh --with-users
must 20-seed-reference.sh
check "first seed ends with seed ok" "$(tail -1 <<<"$out")" "seed ok"
first_counts="$(grep '^seed: ' <<<"$out")"

check "units of the plant" "$(sql 'SELECT code FROM forge.units ORDER BY 1')" "EXT-Line2,Extruder1"
check "14 plant accounts" "$(sql "SELECT count(*) FROM forge.users WHERE email LIKE '%@hdpe-train.mpc'")" 14
check "loss accounting v3 is daily" "$(sql "SELECT body->>'grain' FROM forge.accounting_policies
  WHERE policy_kind = 'loss_accounting' AND version = 3")" day
check "state mappings resolve their signals" "$(sql 'SELECT count(*) FROM forge.unit_state_mappings m
  WHERE NOT EXISTS (SELECT 1 FROM forge.signals s WHERE s.id = m.signal_id)')" 0
check "self-referencing rows load parents first" "$(sql 'SELECT count(*) FROM forge.reason_codes
  WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM forge.reason_codes)')" 0

run 20-seed-reference.sh --with-users
must "second 20-seed-reference.sh"
check "second seed ends with seed ok" "$(tail -1 <<<"$out")" "seed ok"
check "second seed leaves the counts unchanged" "$(grep '^seed: ' <<<"$out")" "$first_counts"

sql "INSERT INTO forge.crews (id, tenant_id, site_id, name, row_version)
  SELECT gen_random_uuid(), tenant_id, site_id, 'Extra crew', 1 FROM forge.crews LIMIT 1;" >/dev/null
run 20-seed-reference.sh --with-users
check "a re-run passes on a database with extra rows" "$(tail -1 <<<"$out")" "seed ok"

check "RLS shows the plant's units to its tenant" \
  "$(sql "SET ROLE proact_rls_user; SET app.tenant_ids = '$tenant_id'; SELECT count(*) FROM forge.units;")" 2
check "RLS hides them from another tenant" "$(sql "SET ROLE proact_rls_user;
  SET app.tenant_ids = '00000000-0000-0000-0000-000000000000'; SELECT count(*) FROM forge.units;")" 0

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
