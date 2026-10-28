#!/usr/bin/env bash
# Builds the production images through deploy/build/build-images.sh (FORGE_VERSION=test) and checks them
# without a database:
# OCI labels, the non-root nginx (uid 101) with security headers and /piwebapi off when PI_SERVER is empty,
# the backend's APP_VERSION, and that deploy/docker-compose.forge.yml renders with the fixture env.
# Container: forge-test-frontend (127.0.0.1:<first free port from 18095>), removed on exit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy="$here/.."
version=test
frontend=forge-test-frontend

cleanup() {
  docker rm -f "$frontend" >/dev/null 2>&1 || true
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

# is <actual> <expected>: "true" when both strings are equal.
is() {
  if [[ "$1" == "$2" ]]; then echo true; else echo false; fi
}

label() {
  docker inspect "$1" --format '{{index .Config.Labels "org.opencontainers.image.title"}}' 2>/dev/null || true
}

# free_port <from>: the first loopback port from <from> on that nothing listens on.
free_port() {
  local candidate="$1"
  while (exec 3<>"/dev/tcp/127.0.0.1/$candidate") 2>/dev/null; do
    candidate=$((candidate + 1))
  done
  echo "$candidate"
}

# wait_http <url>: until the URL answers at all (any status), at most 30 s.
wait_http() {
  local tries=0
  until curl -s -o /dev/null "$1"; do
    tries=$((tries + 1))
    (( tries < 30 )) || return 0
    sleep 1
  done
}

cleanup
bash "$deploy/build/build-images.sh" --version "$version" --allow-dirty >/dev/null
port="$(free_port 18095)"

check "image labels name both images" "$(is "$(label "traverse-forge-frontend:$version")/$(label \
  "traverse-forge-backend:$version")" 'traverse-forge-frontend/traverse-forge-backend')"

docker run -d --name "$frontend" -e BACKEND_URL=http://127.0.0.1:9 -p "127.0.0.1:$port:8080" \
  "traverse-forge-frontend:$version" >/dev/null
wait_http "http://127.0.0.1:$port/"
uid="$(MSYS_NO_PATHCONV=1 docker exec "$frontend" id -u 2>/dev/null || true)"
check "frontend runs as uid 101" "$(is "$uid" 101)"
headers="$(curl -sI "http://127.0.0.1:$port/" || true)"
check "x-content-type-options on /" \
  "$(grep -qi '^x-content-type-options: nosniff' <<<"$headers" && echo true || echo false)"
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/piwebapi/x" || true)"
check "piwebapi off without PI_SERVER (got $code)" "$(is "$code" 404)"

app_version="$(docker run --rm --entrypoint node "traverse-forge-backend:$version" \
  -e 'console.log(process.env.APP_VERSION)' 2>/dev/null || true)"
check "backend APP_VERSION (got '$app_version')" "$(is "$app_version" "$version")"

rc=0
rendered="$(docker compose -f "$deploy/docker-compose.forge.yml" --env-file "$here/fixtures/forge.env" \
  config 2>&1)" || rc=$?
check "forge compose renders with the fixture env" "$(is "$rc" 0)"
check "forge compose names traverse-forge-worker" \
  "$(grep -q 'container_name: traverse-forge-worker' <<<"$rendered" && echo true || echo false)"
[[ $rc -eq 0 ]] || echo "$rendered" >&2

total=$((passed + failed))
if (( failed > 0 )); then
  echo "FAIL $passed/$total"
  exit 1
fi
echo "ok $passed/$total"
