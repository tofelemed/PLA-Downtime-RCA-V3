#!/usr/bin/env bash
# Export one TypeORM migration as db/migrations/V<nnn>__<slug>.sql in schema forge (TF-PREP-001 task 3).
#   bash deploy/db/export-migration.sh --name FkIndexes1794242000000 --version 002 --slug fk_indexes
# On a throwaway postgres:15-alpine container (forge-export-pg, 127.0.0.1:55432): bootstraps the database
# with 00-create-db-and-roles.sh, applies db/migrations/V*.sql below <nnn> with 10-migrate.sh (so
# forge.migrations says "applied through V<nnn-1>"), checks that <Name> is the only pending TypeORM
# migration, runs it with DB_SCHEMA=forge DB_LOGGING=true and keeps the statements it logged.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

usage() {
  echo "usage: export-migration.sh --name <MigrationClassName> --version <nnn> --slug <slug>" >&2
  exit 2
}

repo_root="$(cd "$here/../.." && pwd)"
backend="$repo_root/server/pro-act-backend"
container=forge-export-pg
port=55432
name=""
version=""
slug=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) [[ $# -ge 2 ]] || usage; name="$2"; shift 2 ;;
    --version) [[ $# -ge 2 ]] || usage; version="$2"; shift 2 ;;
    --slug) [[ $# -ge 2 ]] || usage; slug="$2"; shift 2 ;;
    *) usage ;;
  esac
done
[[ "$name" =~ ^[A-Za-z][A-Za-z0-9]*([0-9]{13})$ ]] || usage
timestamp="${BASH_REMATCH[1]}"
[[ "$version" =~ ^[0-9]{3}$ && "$slug" =~ ^[a-z0-9_]+$ ]] || usage
out="$repo_root/db/migrations/V${version}__${slug}.sql"
[[ ! -e "$out" ]] || forge_die "$out already exists; an exported file never changes"
compgen -G "$repo_root/db/migrations/V${version}__*.sql" >/dev/null && forge_die "V$version already exists"

work="$(mktemp -d)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
  rm -f "$out.tmp"
}
trap cleanup EXIT

start_container() {
  local tries=0
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres \
    -p "127.0.0.1:$port:5432" postgres:15-alpine >/dev/null
  until MSYS_NO_PATHCONV=1 docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres; do
    tries=$((tries + 1))
    (( tries < 60 )) || forge_die "$container did not become ready"
    sleep 1
  done
}

# stage_earlier_files: copy of db/ holding only the V files below <nnn> and their manifest lines.
stage_earlier_files() {
  local path file
  bash "$here/checksums.sh" --check >/dev/null || forge_die "db/CHECKSUMS.sha256 does not match db/"
  mkdir -p "$work/db/migrations"
  : > "$work/db/CHECKSUMS.sha256"
  for path in "$repo_root"/db/migrations/V*.sql; do
    [[ -e "$path" ]] || continue
    file="$(basename "$path")"
    (( 10#${file:1:3} < 10#$version )) || continue
    cp "$path" "$work/db/migrations/"
    grep -F "  migrations/$file" "$repo_root/db/CHECKSUMS.sha256" >> "$work/db/CHECKSUMS.sha256"
  done
}

# typeorm <command> <log>: the TypeORM CLI against the scratch database in schema forge, logging queries.
typeorm() {
  (
    cd "$backend"
    DB_HOST=127.0.0.1 DB_PORT="$port" DB_USERNAME=postgres DB_USER=postgres DB_PASSWORD=postgres \
      DB_NAME=traverse_forge DB_SCHEMA=forge DB_SSL=false DB_MIGRATIONS_RUN=false DB_MIGRATIONS_DIR= \
      DB_LOGGING=true npm run "$1" > "$2" 2>&1
  )
}

# check_pending: <Name> must be the only migration migration:show lists as not applied.
check_pending() {
  local log="$work/show.log" pending
  typeorm migration:show "$log" || true
  grep -q '\[X\]' "$log" || { tail -40 "$log" >&2; forge_die "migration:show failed"; }
  pending="$(sed -n 's/^.*\[ \] \(.*\)$/\1/p' "$log" | awk '{print $NF}' | tr -d '\r')"
  [[ -n "$pending" ]] || forge_die "$name is not pending (nothing is)"
  [[ "$(wc -l <<<"$pending")" -eq 1 ]] || forge_die "more than one migration is pending: $(echo $pending)"
  [[ "$pending" == "$name" ]] || forge_die "$name is not pending; pending is $pending"
}

# extract_queries <log>: the statements logged after "must be executed" up to "<Name> has been executed
# successfully", one per statement with a trailing semicolon. Transaction control and TypeORM's own
# parameterised insert into migrations are dropped (the export appends a literal one); any other
# parameterised statement cannot be exported as plain SQL and stops the export (exit 3).
extract_queries() {
  sed -e 's/\x1b\[[0-9;]*m//g' -e 's/\r$//' "$1" | awk -v name="$name" '
    function flush() {
      if (stmt == "") return
      if (stmt ~ /^(START TRANSACTION|BEGIN|COMMIT)$/) { stmt = ""; return }
      if (stmt ~ /^INSERT INTO ("[a-z_]+"\.)?"migrations"\("timestamp", "name"\) VALUES \(\$1, \$2\)/) {
        stmt = ""; return
      }
      if (stmt ~ /-- PARAMETERS:/) { print "parameterised query: " stmt > "/dev/stderr"; failed = 1; exit 3 }
      sub(/[ \t\n;]+$/, "", stmt)
      print stmt ";"
      stmt = ""
    }
    /migrations are new migrations must be executed/ { open = 1; stmt = ""; next }
    /^Migration [A-Za-z0-9]+ has been +executed successfully/ {
      if ($2 == name) { flush(); done = 1; exit 0 }
      open = 1; stmt = ""; next
    }
    !open { next }
    /^query failed:/ { print "a query failed" > "/dev/stderr"; failed = 1; exit 3 }
    /^query: / { flush(); stmt = substr($0, 8); next }
    stmt != "" { stmt = stmt "\n" $0 }
    END { if (!failed && !done) { print "no success line for " name > "/dev/stderr"; exit 4 } }
  '
}

write_export() {
  local log="$1" commit
  commit="$(git -C "$repo_root" describe --always)"
  if [[ -n "$(git -C "$repo_root" status --porcelain --ignore-submodules=all --untracked-files=no)" ]]; then
    commit="$commit-dirty"
  fi
  extract_queries "$log" > "$work/queries.sql" || forge_die "could not extract the statements of $name"
  [[ -s "$work/queries.sql" ]] || forge_die "$name logged no statements"
  {
    echo "-- V$version $slug: TypeORM migration $name exported $(date -u +%Y-%m-%d) from $commit"
    echo "SET search_path = forge, public;"
    forge_python "$here/rewrite-schema.py" < "$work/queries.sql"
    echo "INSERT INTO forge.migrations(\"timestamp\",\"name\") VALUES ($timestamp, '$name');"
  } > "$out.tmp"
  mv "$out.tmp" "$out"
  echo "wrote $out ($(grep -c ';$' "$out") statements)"
}

stage_earlier_files
start_container
echo "started $container on 127.0.0.1:$port"
printf '%s\n' "DB_CONTAINER=$container" DB_USER=postgres DB_PASSWORD=postgres DB_NAME=traverse_forge \
  DB_SCHEMA=forge > "$work/forge.env"
bash "$here/00-create-db-and-roles.sh" --env "$work/forge.env"
DB_DIR="$work/db" bash "$here/10-migrate.sh" --env "$work/forge.env"
check_pending
typeorm migration:run "$work/run.log" || { tail -40 "$work/run.log" >&2; forge_die "migration:run failed"; }
write_export "$work/run.log"
