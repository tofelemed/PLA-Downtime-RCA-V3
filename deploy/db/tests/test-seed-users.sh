#!/usr/bin/env bash
# End to end on a throwaway postgres:15-alpine container (forge-users-pg, 127.0.0.1:55437): 00, 10 and
# 20-seed-reference.sh (reference only), then the seed-users CLI (ts-node) with the example CSV twice.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_db="$here/.."
repo_root="$(cd "$here/../../.." && pwd)"
backend="$repo_root/server/pro-act-backend"
container=forge-users-pg
port=55437
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

# cli <passwords file> [csv] [db name] [extra args...]: the seed-users CLI against the scratch database;
# sets rc and out. Passwords files live in the mktemp dir, outside the repo.
cli() {
  local file="$1" csv="${2:-$repo_root/deploy/seed-users.csv.example}" name="${3:-traverse_forge}"
  shift 3 || shift $#
  rc=0
  out="$(cd "$backend" && DB_HOST=127.0.0.1 DB_PORT=$port DB_USERNAME=postgres DB_PASSWORD=postgres \
    DB_NAME="$name" DB_SCHEMA=forge npx ts-node scripts/deploy/seed-users.ts \
    --csv "$csv" --tenant-code HDPE-TRAIN --out "$file" "$@" 2>&1)" || rc=$?
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
must 00-create-db-and-roles.sh
run 10-migrate.sh
must 10-migrate.sh
run 20-seed-reference.sh
must 20-seed-reference.sh

cli "$work/passwords-1.txt"
must "first seed-users run"
check "first run creates both" "$(tail -1 <<<"$out" | sed 's/, passwords in.*//')" "created 2, skipped 0"
# NTFS (Git Bash on Windows) has no POSIX mode bits; the mode is asserted on Linux and macOS only.
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) echo "skip: file mode check (no POSIX permissions on this filesystem)" ;;
  *) check "passwords file has mode 600" "$(stat -c %a "$work/passwords-1.txt")" 600 ;;
esac
check "passwords file has two lines" "$(wc -l < "$work/passwords-1.txt" | tr -d ' ')" 2
first_password="$(head -1 "$work/passwords-1.txt" | cut -d, -f2)"
check "no password on stdout" "$(grep -cF "$first_password" <<<"$out" || true)" 0
check "users exist and are active" "$(sql "SELECT count(*) FROM forge.users WHERE email LIKE '%@example.invalid' AND is_active")" 2
check "tenant scopes exist" "$(sql "SELECT string_agg(s.role, ',' ORDER BY s.role) FROM forge.user_scopes s
  JOIN forge.users u ON u.id = s.user_id WHERE u.email LIKE '%@example.invalid' AND s.scope_kind = 'tenant'
  AND s.scope_id = u.tenant_id")" "manager_approver,viewer"

cli "$work/passwords-2.txt"
must "second seed-users run"
check "second run skips both" "$(tail -1 <<<"$out" | sed 's/, passwords in.*//')" "created 0, skipped 2"
check "no duplicate users" "$(sql "SELECT count(*) FROM forge.users WHERE email LIKE '%@example.invalid'")" 2

cli "$work/passwords-1.txt"
check "refuses an existing passwords file" "$([[ $rc -ne 0 ]] && echo refused)" refused

printf 'email,name,role,scope_role\nbad.scope@example.invalid,Bad,Analyst,boss\n' > "$work/bad.csv"
cli "$work/passwords-3.txt" "$work/bad.csv"
check "unknown scope_role is refused" "$(grep -c 'line 2: unknown scope_role "boss"' <<<"$out" || true)" 1
cli "$work/passwords-4.txt" "" " Proact "
check "DB_NAME=proact is refused" "$(grep -c 'development database; refusing' <<<"$out" || true)" 1
cli "$repo_root/deploy/passwords-test.txt"
check "an output path inside the git work tree is refused" "$(grep -c 'inside a git work tree' <<<"$out" || true)" 1
check "and no file was created there" "$([[ -e "$repo_root/deploy/passwords-test.txt" ]] && echo yes || echo no)" no

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
