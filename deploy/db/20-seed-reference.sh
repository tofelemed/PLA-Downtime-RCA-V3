#!/usr/bin/env bash
# Load the reference seed (TF-PREP-001 task 4) into an installed, migrated database.
#   bash deploy/db/20-seed-reference.sh [--env <file>] [--with-users]
# Env file as in 00-create-db-and-roles.sh; DB_DIR overrides the SQL directory (default: db/ of the repo).
# Verifies CHECKSUMS.sha256, applies db/seed/reference/R*.sql in name order (each file is one transaction
# of INSERT ... ON CONFLICT DO NOTHING, so a re-run is a no-op), then with --with-users the git-ignored
# db/seed/generated/U010__users.sql after checking its INSERT count per table against manifest.json.
# Finally every seeded table's row count (manifest filters) must equal the manifest: `seed: <table> <n>`.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

usage() {
  forge_die "usage: 20-seed-reference.sh [--env <file>] [--with-users]"
}

env_arg=""
with_users=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) [[ $# -ge 2 ]] || usage; env_arg="$2"; shift 2 ;;
    --with-users) with_users=true; shift ;;
    *) usage ;;
  esac
done
forge_load_env "$(forge_env_file "$env_arg")"
forge_check_db_env
[[ "$DB_SCHEMA" == forge ]] || forge_die "db/seed targets schema forge; DB_SCHEMA is $DB_SCHEMA"
db_dir="$(cd "${DB_DIR:-$here/../../db}" && pwd)"
seed_dir="$db_dir/seed"
manifest="$seed_dir/manifest.json"
users_file="$seed_dir/generated/U010__users.sql"
uuid_re='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

# manifest_query <sql>: unaligned tuples of the SQL with the manifest bound to psql variable m (json).
manifest_query() {
  forge_psql "$DB_NAME" -X -q -At -F ' ' -v m="$(cat "$manifest")" <<<"$1"
}

# where_for <table>: the extraction's row filter (scripts/deploy/extract/table-plan.ts rowFilter).
where_for() {
  case "$1" in
    organizations) echo "id = '$org_id'" ;;
    tenants) echo "id = '$tenant_id'" ;;
    app_settings) echo "tenant_id = '$tenant_id' OR tenant_id IS NULL" ;;
    *) echo "tenant_id = '$tenant_id'" ;;
  esac
}

# check_users_file: the generated file holds exactly the manifest's row count for each of its tables.
check_users_file() {
  local file table expected actual
  [[ -f "$users_file" ]] ||
    forge_die "db/seed/generated/U010__users.sql is missing: copy it from the extraction (it is not in git)"
  while read -r file table expected; do
    [[ "$file" == U010__users ]] || continue
    actual="$(grep -c "^INSERT INTO $table (" "$users_file" || true)"
    [[ "$actual" == "$expected" ]] ||
      forge_die "U010__users.sql has $actual rows of $table, manifest.json says $expected"
  done <<<"$entries"
}

apply_file() {
  forge_psql "$DB_NAME" -X -q >/dev/null < "$1" || forge_die "$(basename "$1") failed; its transaction was rolled back"
  echo "applied $(basename "$1")"
}

DB_DIR="$db_dir" bash "$here/checksums.sh" --check >/dev/null || forge_die "checksums.sh --check failed"
echo "checksums: ok"
[[ -f "$manifest" ]] || forge_die "db/seed/manifest.json is missing"
ids="$(manifest_query "SELECT :'m'::json->>'tenantId', :'m'::json->>'organizationId';")"
read -r tenant_id org_id <<<"$ids"
[[ "$tenant_id" =~ $uuid_re && "$org_id" =~ $uuid_re ]] || forge_die "manifest.json lacks tenantId / organizationId"
entries="$(manifest_query "SELECT f.key, t.value, (:'m'::json->'tables'->>t.value)::int
  FROM json_each(:'m'::json->'files') f, json_array_elements_text(f.value) t ORDER BY f.key;")"
[[ -n "$entries" ]] || forge_die "manifest.json lists no files"
if [[ "$with_users" == true ]]; then check_users_file; fi

shopt -s nullglob
reference_files=("$seed_dir"/reference/R*.sql)
(( ${#reference_files[@]} > 0 )) || forge_die "no db/seed/reference/R*.sql files"
for path in "${reference_files[@]}"; do apply_file "$path"; done
if [[ "$with_users" == true ]]; then apply_file "$users_file"; fi

bad=0
while read -r file table expected; do
  [[ "$file" != U010__users || "$with_users" == true ]] || continue
  [[ "$table" =~ ^[a-z_][a-z0-9_]*$ ]] || forge_die "unexpected table name in manifest.json: $table"
  actual="$(forge_psql "$DB_NAME" -X -q -At <<<"SELECT count(*) FROM \"$DB_SCHEMA\".$table WHERE $(where_for "$table");")"
  echo "seed: $table $actual"
  if [[ "$actual" != "$expected" ]]; then
    echo "mismatch: $table has $actual rows, manifest.json says $expected" >&2
    bad=1
  fi
done <<<"$entries"
(( bad == 0 )) || forge_die "row counts differ from manifest.json"
echo "seed ok"
