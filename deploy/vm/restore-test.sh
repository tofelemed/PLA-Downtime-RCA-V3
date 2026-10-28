#!/usr/bin/env bash
# Prove that a backup-forge.sh dump restores (TF-PREP-001 task 7).
#   bash restore-test.sh <traverse-forge-<db>-<utc>.dump>
# Checks the dump's .sha256 when present, creates the temporary database traverse_forge_restore_<ts> on
# the same server ($DB_CONTAINER), adds the extensions and the schema the dump expects, runs
# pg_restore -n $DB_SCHEMA inside the container, counts the schema's tables and the rows of units and
# users, and drops the temporary database again (also on failure). Prints `restore ok: <n> tables ...`.
# DB_USER needs CREATEDB (the deploy login owns traverse_forge, decision 2026-10-26).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

[[ $# -eq 1 ]] || forge_die "usage: restore-test.sh <dump file>"
dump="$1"
[[ -f "$dump" ]] || forge_die "dump not found: $dump"
vm_load_env
forge_check_db_env
export DB_CONTAINER="${DB_CONTAINER:-instrumental-postgres}"
target="traverse_forge_restore_$(date -u +%Y%m%d%H%M%S)"
created=false

# query <db> <sql>: unaligned tuples of the SQL.
query() {
  forge_psql "$1" -X -q -At <<<"$2"
}

cleanup() {
  if [[ "$created" == true ]]; then
    query postgres "DROP DATABASE IF EXISTS \"$target\";" >/dev/null 2>&1 ||
      echo "warn: could not drop $target; drop it by hand" >&2
  fi
}
trap cleanup EXIT

# check_digest: the .sha256 written by backup-forge.sh matches the dump.
check_digest() {
  local expected
  [[ -f "$dump.sha256" ]] || { echo "warn: $dump.sha256 not found; digest not checked" >&2; return 0; }
  expected="$(cut -d' ' -f1 < "$dump.sha256")"
  [[ "$(forge_sha256 "$dump")" == "$expected" ]] || forge_die "$dump does not match $dump.sha256"
}

# prepare_target: empty database with the extensions in public and the schema (pg_restore -n restores
# the objects in the schema, not the schema itself).
prepare_target() {
  query postgres "CREATE DATABASE \"$target\";" >/dev/null
  created=true
  query "$target" "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA public;
    CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA public;
    CREATE SCHEMA \"$DB_SCHEMA\";" >/dev/null
}

# restore: pg_restore inside the container, the dump on stdin, no owner changes.
restore() {
  PGPASSWORD="${DB_PASSWORD:-}" MSYS_NO_PATHCONV=1 docker exec -i -e PGPASSWORD "$DB_CONTAINER" \
    pg_restore -U "$DB_USER" -d "$target" -n "$DB_SCHEMA" --no-owner --exit-on-error < "$dump" ||
    forge_die "pg_restore into $target failed"
}

check_digest
prepare_target
restore
tables="$(query "$target" "SELECT count(*) FROM information_schema.tables
  WHERE table_schema = '$DB_SCHEMA' AND table_type = 'BASE TABLE';")"
units="$(query "$target" "SELECT count(*) FROM \"$DB_SCHEMA\".units;")"
users="$(query "$target" "SELECT count(*) FROM \"$DB_SCHEMA\".users;")"
(( tables > 0 )) || forge_die "restored $target holds no tables in $DB_SCHEMA"
query postgres "DROP DATABASE \"$target\";" >/dev/null || forge_die "could not drop $target; drop it by hand"
created=false
echo "restore ok: $tables tables (units $units rows, users $users rows) in $target, dropped"
