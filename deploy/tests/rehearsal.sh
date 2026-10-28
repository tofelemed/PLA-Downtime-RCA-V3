#!/usr/bin/env bash
# End-to-end rehearsal of the first VM install (TF-PREP-001 task 8) on a workstation, with a throwaway
# postgres:15-alpine (forge-rehearsal-pg from deploy/docker-compose.local.yml) in place of the shared
# database container. Drives the operator's scripts in the order of deploy/vm/VM-STEPS.template.md:
#   write deploy/.env.local (generated secrets; git-ignored, never printed) -> build-images.sh ->
#   package-bundle.sh -> remove the local images (the VM has none) -> install.sh into a temp FORGE_HOME ->
#   .env.local as $FORGE_HOME/.env -> compose up postgres -> 00 -> 10 -> 20 --with-users ->
#   load-and-start.sh (docker load, compose up, verify.sh) -> health, sign-in, policy and empty-events
#   checks through the UI port -> 30-seed-users.sh -> backup-forge.sh -> restore-test.sh ->
#   rollback.sh (must refuse: no previous version) -> teardown.
#
#   REHEARSAL_PASSWORD=<dev password of the seeded accounts> bash deploy/tests/rehearsal.sh [--keep]
#   bash deploy/tests/rehearsal.sh --teardown <FORGE_HOME printed by --keep>
#
# --keep leaves the stack running (http://localhost:8096) and prints the teardown command. Each step's
# full output goes to <temp>/work/logs/; the console shows its last line. Stops at the first failure and
# leaves everything in place for inspection (the teardown command is printed).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy="$(cd "$here/.." && pwd)"
version=rehearsal
ui_port=8096
env_local="$deploy/.env.local"
images=("traverse-forge-backend:$version" "traverse-forge-frontend:$version")

# shellcheck source=../vm/lib-vm.sh
source "$deploy/vm/lib-vm.sh"

export FORGE_COMPOSE_EXTRA="-f $(vm_host_path "$deploy/docker-compose.local.yml")"

# teardown_stack <root>: compose down -v, the rehearsal images and the temp folder.
teardown_stack() {
  local root="$1"
  export FORGE_HOME="$root/home"
  if [[ -f "$FORGE_HOME/.env" && -f "$(vm_release_dir "$version")/docker-compose.forge.yml" ]]; then
    vm_compose "$version" down -v --remove-orphans
  fi
  docker rmi "${images[@]}" >/dev/null 2>&1 || true
  rm -rf "$root"
  echo "teardown ok"
}

if [[ "${1:-}" == --teardown ]]; then
  [[ $# -eq 2 ]] || forge_die "usage: rehearsal.sh --teardown <FORGE_HOME>"
  [[ "$(basename "$2")" == home && "$(basename "$(dirname "$2")")" == forge-rehearsal.* ]] ||
    forge_die "not a rehearsal FORGE_HOME: $2"
  teardown_stack "$(dirname "$2")"
  exit 0
fi
keep=false
case "${1:-}" in
  --keep) keep=true ;;
  "") ;;
  *) forge_die "usage: rehearsal.sh [--keep] | --teardown <FORGE_HOME>" ;;
esac
[[ -n "${REHEARSAL_PASSWORD:-}" ]] || forge_die "REHEARSAL_PASSWORD is not set (dev password of the seeded accounts)"
for name in forge-rehearsal-pg traverse-forge-backend traverse-forge-worker traverse-forge-frontend; do
  ! docker inspect "$name" >/dev/null 2>&1 || forge_die "container $name exists: tear the previous rehearsal down first"
done

root="$(vm_host_path "$(mktemp -d "${TMPDIR:-/tmp}/forge-rehearsal.XXXXXX")")"
export FORGE_HOME="$root/home"
work="$root/work"
mkdir -p "$FORGE_HOME" "$work/logs" "$work/bundle"
chmod 700 "$work"
release="$(vm_release_dir "$version")"
teardown_hint="bash deploy/tests/rehearsal.sh --teardown $FORGE_HOME"
step_no=0

# run_logged <log> <command...>: the command in a subshell with `set -e` in force, its exit status in
# step_rc. Never call it under || or if: bash suspends `set -e` for everything such a command runs.
run_logged() {
  local log="$1"
  shift
  set +e
  ( set -e; "$@" ) >"$log" 2>&1 </dev/null
  step_rc=$?
  set -e
}

# step <name> <expected text or ""> <command...>: run, log, print the last line; abort on failure.
step() {
  local name="$1" expect="$2" log rc last
  shift 2
  step_no=$((step_no + 1))
  log="$work/logs/$(printf '%02d' "$step_no")-$name.log"
  run_logged "$log" "$@"
  rc=$step_rc
  last="$(tail -n 1 "$log")"
  echo "[$name] $last"
  if [[ $rc -ne 0 || ( -n "$expect" && "$(cat "$log")" != *"$expect"* ) ]]; then
    tail -n 20 "$log" >&2
    echo "rehearsal failed at $name (exit $rc); log $log; teardown: $teardown_hint" >&2
    exit 1
  fi
}

# step_refused <name> <expected text> <command...>: the command must fail with that text in its output.
step_refused() {
  local name="$1" expect="$2" log rc
  shift 2
  step_no=$((step_no + 1))
  log="$work/logs/$(printf '%02d' "$step_no")-$name.log"
  run_logged "$log" "$@"
  rc=$step_rc
  echo "[$name] exit $rc: $(tail -n 1 "$log")"
  if [[ $rc -eq 0 || "$(cat "$log")" != *"$expect"* ]]; then
    echo "rehearsal failed at $name: expected a refusal containing '$expect'; teardown: $teardown_hint" >&2
    exit 1
  fi
}

# secret: 48 random bytes, base64 without / + = (the generator of deploy/.env.example).
secret() {
  openssl rand -base64 48 | tr -d '\n/+='
}

# write_env_local: .env.example with the rehearsal values; secrets travel through the environment of awk
# (never on a command line, never printed). Mode 600.
write_env_local() {
  (
    export R_FORGE_VERSION="$version" R_FORGE_UI_PORT="$ui_port" R_PG_NETWORK=forge-rehearsal-pgnet \
      R_DB_HOST=forge-rehearsal-pg R_DB_CONTAINER=forge-rehearsal-pg R_DB_USER=postgres \
      R_DB_NAME=traverse_forge R_DB_SCHEMA=forge R_CORS_ORIGIN="http://localhost:$ui_port"
    R_DB_PASSWORD="$(secret)" R_JWT_SECRET="$(secret)" R_JWT_REFRESH_SECRET="$(secret)"
    R_CREDENTIAL_ENCRYPTION_KEYS="k1:$(secret)"
    export R_DB_PASSWORD R_JWT_SECRET R_JWT_REFRESH_SECRET R_CREDENTIAL_ENCRYPTION_KEYS
    umask 077
    awk '
      BEGIN { for (k in ENVIRON) if (k ~ /^R_/) want[substr(k, 3)] = ENVIRON[k] }
      match($0, /^[A-Za-z_][A-Za-z0-9_]*=/) {
        key = substr($0, 1, RLENGTH - 1)
        if (key in want) { print key "=" want[key]; seen[key] = 1; next }
      }
      { print }
      END { for (k in want) if (!(k in seen)) print k "=" want[k] }
    ' "$deploy/.env.example" > "$env_local"
  )
  chmod 600 "$env_local"
  [[ -z "$(vm_placeholders "$env_local")" ]] || forge_die "$env_local still holds CHANGE_ME"
  echo "wrote deploy/.env.local (values not shown)"
}

# use_env_local: the real flow edits the template install.sh copied; the rehearsal substitutes the file.
use_env_local() {
  cp "$env_local" "$FORGE_HOME/.env"
  chmod 600 "$FORGE_HOME/.env"
  echo "copied deploy/.env.local to $FORGE_HOME/.env"
}

remove_local_images() {
  docker rmi "${images[@]}" >/dev/null
  echo "removed ${images[*]} (load-and-start.sh loads them from the bundle)"
}

# start_postgres: the local override's postgres service, then pg_isready over TCP (the init server only
# listens on the socket, so TCP readiness means the real server is up).
start_postgres() {
  local tries=0
  vm_compose "$version" up -d postgres
  until MSYS_NO_PATHCONV=1 docker exec forge-rehearsal-pg pg_isready -q -h 127.0.0.1 -U postgres; do
    tries=$((tries + 1))
    (( tries < 60 )) || forge_die "forge-rehearsal-pg not ready after 60 s"
    sleep 1
  done
  echo "postgres ready: forge-rehearsal-pg (127.0.0.1:55436)"
}

base="http://127.0.0.1:$ui_port"

# json <path> < file: the value at a dotted path of the JSON on stdin ("" when absent).
json() {
  forge_python -c '
import json, sys
value = json.load(sys.stdin)
for part in sys.argv[1].split("."):
    value = value[int(part)] if isinstance(value, list) else (value or {}).get(part)
print(json.dumps(value) if isinstance(value, (list, dict)) else ("" if value is None else value))
' "$1"
}

check_health() {
  local code ver
  code="$(vm_http_code "$base/api/health/ready")"
  [[ "$code" == 200 ]] || forge_die "GET /api/health/ready = $code"
  ver="$(vm_http_body "$base/api/health" | json version)"
  [[ "$ver" == "$version" ]] || forge_die "GET /api/health version = '$ver'"
  echo "health: ready 200, version $ver (through :$ui_port)"
}

# login <name>: POST /api/auth/login as <name>@hdpe-train.mpc; the body is built from REHEARSAL_PASSWORD
# in the environment and sent on stdin. Writes $work/headers-<name> (Authorization, X-Tenant-Id; mode 600).
login() {
  local name="$1" response="$work/login-$name.json" code token tenant
  code="$(EMAIL="$name@hdpe-train.mpc" forge_python -c '
import json, os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["REHEARSAL_PASSWORD"]}))
' | curl -s -m 20 -o "$response" -w '%{http_code}' -H 'Content-Type: application/json' \
    --data-binary @- "$base/api/auth/login")"
  [[ "$code" == 200 || "$code" == 201 ]] || forge_die "login $name: HTTP $code"
  token="$(json access_token < "$response")"
  tenant="$(json user.tenantId < "$response")"
  [[ -n "$token" && -n "$tenant" ]] || forge_die "login $name: no access_token or user.tenantId"
  printf 'Authorization: Bearer %s\nX-Tenant-Id: %s\n' "$token" "$tenant" > "$work/headers-$name"
  rm -f "$response"
  echo "login $name@hdpe-train.mpc: HTTP $code, tenant $tenant"
}

# api_get <name> <path>: GET through the UI port with the headers of <name>; body on stdout.
api_get() {
  local out="$work/get.json" code
  code="$(curl -s -m 20 -o "$out" -w '%{http_code}' -H @"$work/headers-$1" "$base$2")"
  [[ "$code" == 200 ]] || forge_die "GET $2 as $1: HTTP $code"
  cat "$out"
}

# check_policy: the in-force tenant-wide loss_accounting version is daily, declared, on HDPE Extruder 1.
check_policy() {
  local body grain basis unit unit_name
  body="$(api_get admin /api/v2/loss-accounting)"
  grain="$(json policy.grain <<<"$body")"
  basis="$(json policy.lossBasis <<<"$body")"
  unit="$(json policy.accountingUnitId <<<"$body")"
  [[ "$grain" == day && "$basis" == declared && -n "$unit" ]] ||
    forge_die "loss accounting in force: grain '$grain', lossBasis '$basis', unit '$unit'"
  unit_name="$(api_get admin "/api/v2/units/$unit" | json name)"
  [[ "$unit_name" == "HDPE Extruder 1" ]] || forge_die "accounting unit is '$unit_name'"
  echo "loss accounting v$(json version <<<"$body"): grain $grain, lossBasis $basis, unit $unit_name"
}

check_events_empty() {
  local items
  items="$(api_get reza '/api/v2/production-events?limit=1' | json items)"
  [[ "$items" == "[]" ]] || forge_die "production events are not empty: $items"
  echo "production events (reza): items []"
}

# seed_users: 30-seed-users.sh from FORGE_HOME (as on the VM); the passwords file must land on the host.
seed_users() {
  (cd "$FORGE_HOME" && bash "$release/deploy/db/30-seed-users.sh" --csv "$deploy/seed-users.csv.example" \
    --env "$FORGE_HOME/.env" --out-dir "$FORGE_HOME/private")
  compgen -G "$FORGE_HOME/private/passwords-*.txt" >/dev/null || forge_die "no passwords file in $FORGE_HOME/private"
}

restore_latest() {
  local dump
  dump="$(find "$FORGE_HOME/backups" -maxdepth 1 -name 'traverse-forge-*.dump' | LC_ALL=C sort | tail -n 1)"
  [[ -n "$dump" ]] || forge_die "no dump in $FORGE_HOME/backups"
  bash "$release/deploy/vm/restore-test.sh" "$dump"
}

echo "rehearsal: FORGE_HOME=$FORGE_HOME"
step env-local "" write_env_local
step build-images "built traverse-forge-frontend:$version" \
  bash "$deploy/build/build-images.sh" --version "$version" --allow-dirty
step package-bundle "bundle " bash "$deploy/build/package-bundle.sh" --version "$version" --out "$work/bundle"
step remove-local-images "" remove_local_images
step install "installed $version at" bash "$deploy/vm/install.sh" "$work/bundle/traverse-forge-$version.tar.gz"
step env "" use_env_local
step postgres-up "postgres ready" start_postgres
step 00-create-db-and-roles "ok ledger" bash "$release/deploy/db/00-create-db-and-roles.sh" --env "$FORGE_HOME/.env"
step 10-migrate "migrations: applied 2, skipped 0" bash "$release/deploy/db/10-migrate.sh" --env "$FORGE_HOME/.env"
step 20-seed-reference "seed ok" \
  bash "$release/deploy/db/20-seed-reference.sh" --env "$FORGE_HOME/.env" --with-users
step load-and-start "verify ok $version" bash "$release/deploy/vm/load-and-start.sh" "$version"
step health "" check_health
step login-admin "" login admin
step login-reza "" login reza
step policy "" check_policy
step events-empty "" check_events_empty
step 30-seed-users "created 2" seed_users
step backup-forge "traverse-forge-uploads-" bash "$release/deploy/vm/backup-forge.sh"
step restore-test "restore ok:" restore_latest
step_refused rollback "no previous version" bash "$release/deploy/vm/rollback.sh"
rm -f "$work"/headers-*

if [[ "$keep" == true ]]; then
  echo "kept: UI http://localhost:$ui_port  FORGE_HOME $FORGE_HOME"
  echo "teardown: $teardown_hint"
  echo "  (= FORGE_HOME=$FORGE_HOME FORGE_COMPOSE_EXTRA='$FORGE_COMPOSE_EXTRA' docker compose -p traverse-forge" \
    "--project-directory $FORGE_HOME --env-file $FORGE_HOME/.env -f $release/docker-compose.forge.yml" \
    "$FORGE_COMPOSE_EXTRA down -v --remove-orphans; docker rmi ${images[*]}; rm -rf $root)"
else
  echo "[teardown] $(teardown_stack "$root" 2>&1 | tail -n 1)"
fi
echo "rehearsal ok (${SECONDS}s)"
