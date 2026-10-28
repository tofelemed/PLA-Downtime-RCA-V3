#!/usr/bin/env bash
# Export the TypeORM migrations up to a timestamp as one SQL file in schema forge (TF-PREP-001 task 2).
#   bash deploy/db/export-baseline.sh --through 1794241400000 --out db/migrations/V001__baseline.sql [--keep]
# Runs the migrations on a throwaway postgres:15-alpine container (forge-export-pg, 127.0.0.1:55432),
# dumps the schema (privileges kept: the GRANTs to proact_rls_user) and the migrations bookkeeping rows,
# and rewrites public -> forge with rewrite-schema.py. --keep leaves the container running for checks.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

repo_root="$(cd "$here/../.." && pwd)"
backend="$repo_root/server/pro-act-backend"
container=forge-export-pg
port=55432
image=postgres:15-alpine
through=""
out=""
keep=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --through) through="${2:-}"; shift 2 ;;
    --out) out="${2:-}"; shift 2 ;;
    --keep) keep=true; shift ;;
    *) forge_die "unknown argument: $1" ;;
  esac
done
[[ "$through" =~ ^[0-9]{13}$ ]] || forge_die "--through <13-digit migration timestamp> is required"
[[ -n "$out" ]] || forge_die "--out <file> is required"

# Migrations import ../ helpers relative to src/database, so the copy sits next to migrations/.
# The directory holds migration files only: TypeORM loads every file matching its glob.
staging="$backend/src/database/migrations-export-tmp"
run_log="$backend/src/database/migrations-export-tmp.log"

cleanup() {
  rm -rf "$staging"
  rm -f "$run_log"
  if [[ "$keep" != true ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

stage_migrations() {
  local file name count=0
  rm -rf "$staging"
  mkdir -p "$staging"
  for file in "$backend"/src/database/migrations/*.ts; do
    name="$(basename "$file")"
    [[ "$name" =~ ^([0-9]{13})- ]] || continue
    if (( BASH_REMATCH[1] <= through )); then
      cp "$file" "$staging/"
      count=$((count + 1))
    fi
  done
  (( count > 0 )) || forge_die "no migrations at or before $through"
  echo "$count"
}

start_container() {
  local tries=0
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=traverse_forge \
    -p "127.0.0.1:$port:5432" "$image" >/dev/null
  # The init-time server listens on the socket only; TCP readiness means the final server is up.
  until MSYS_NO_PATHCONV=1 docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres; do
    tries=$((tries + 1))
    (( tries < 60 )) || forge_die "$container did not become ready"
    sleep 1
  done
}

run_migrations() {
  local dir="$staging"
  if command -v cygpath >/dev/null 2>&1; then dir="$(cygpath -m "$staging")"; fi
  if ! (
    cd "$backend"
    DB_MIGRATIONS_DIR="$dir" DB_HOST=127.0.0.1 DB_PORT="$port" DB_USERNAME=postgres DB_USER=postgres \
      DB_PASSWORD=postgres DB_NAME=traverse_forge DB_SCHEMA= DB_SSL=false DB_MIGRATIONS_RUN=false \
      npm run migration:run > "$run_log" 2>&1
  ); then
    tail -40 "$run_log" >&2
    forge_die "migration:run failed"
  fi
  grep -c 'has been  *executed successfully' "$run_log" || true
}

dump() {
  MSYS_NO_PATHCONV=1 docker exec "$container" pg_dump -U postgres -d traverse_forge "$@"
}

count="$(stage_migrations)"
echo "staged $count migrations through $through"
start_container
echo "started $container on 127.0.0.1:$port"
echo "executed $(run_migrations) migrations"

sha="$(git -C "$repo_root" rev-parse --short HEAD)"
mkdir -p "$(dirname "$out")"
{
  echo "-- V001 baseline: TypeORM migrations through $through ($count files) exported $(date -u +%Y-%m-%d) from $sha"
  dump --schema-only --no-owner
  dump --data-only --inserts --table=migrations --table=typeorm_metadata
} | python "$here/rewrite-schema.py" > "$out.tmp"
mv "$out.tmp" "$out"
echo "wrote $out ($(wc -c < "$out" | tr -d ' ') bytes)"
