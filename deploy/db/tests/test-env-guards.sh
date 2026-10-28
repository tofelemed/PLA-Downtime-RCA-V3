#!/usr/bin/env bash
# Guards of forge_load_env (deploy/db/lib.sh) and vm_load_env (deploy/vm/lib-vm.sh) that need no database:
# a value holding $, a quote, # or a space is refused before anything runs, and the message names the
# variable but never prints the value.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

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

# refused <rc> <output> <name> <value>: exit 1, the name in the output, the value not.
refused() {
  [[ "$1" -eq 1 && "$2" == *"$3"* && "$2" != *"$4"* ]] && echo true || echo false
}

printf '%s\n' DB_CONTAINER=none DB_USER=forge_app 'DB_PASSWORD=a$b' DB_NAME=traverse_forge > "$work/dollar.env"
rc=0
out="$(bash "$deploy/db/00-create-db-and-roles.sh" --env "$work/dollar.env" 2>&1)" || rc=$?
check "00 refuses DB_PASSWORD=a\$b naming the variable only (exit $rc)" "$(refused "$rc" "$out" DB_PASSWORD 'a$b')"

printf '%s\n' 'JWT_SECRET="quoted secret"' > "$work/quoted.env"
rc=0
out="$(bash -c 'source "$1/db/lib.sh"; forge_load_env "$2"' _ "$deploy" "$work/quoted.env" 2>&1)" || rc=$?
check "forge_load_env refuses a quoted value with a space (exit $rc)" "$(refused "$rc" "$out" JWT_SECRET 'quoted secret')"

mkdir -p "$work/home"
printf '%s\n' 'DB_PASSWORD=x#y' > "$work/home/.env"
rc=0
out="$(FORGE_HOME="$work/home" bash -c 'source "$1/vm/lib-vm.sh"; vm_load_env' _ "$deploy" 2>&1)" || rc=$?
check "vm_load_env refuses DB_PASSWORD=x#y naming the variable only (exit $rc)" "$(refused "$rc" "$out" DB_PASSWORD 'x#y')"

printf '%s\n' 'CREDENTIAL_ENCRYPTION_KEYS=k1:abc-_.,/@=' 'CONNECTOR_EGRESS_ALLOWLIST=' > "$work/ok.env"
rc=0
out="$(bash -c 'source "$1/db/lib.sh"; forge_load_env "$2"; echo "$CREDENTIAL_ENCRYPTION_KEYS"' _ "$deploy" \
  "$work/ok.env" 2>&1)" || rc=$?
check "forge_load_env accepts plain values (exit $rc)" "$([[ $rc -eq 0 && "$out" == 'k1:abc-_.,/@=' ]] && echo true || echo false)"

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
