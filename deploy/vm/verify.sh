#!/usr/bin/env bash
# Smoke-check the running release through the UI port only (TF-PREP-001 task 7).
#   bash verify.sh [<version>]
# Version: the argument, else $FORGE_HOME/current-version. Checks, in order:
#   GET /api/health/ready = 200 within 90 s; GET /api/health reports "version" = <version>; GET / = 200;
#   container traverse-forge-worker is healthy (waits up to 90 s); GET /api (Swagger) = 404 when
#   FORGE_SWAGGER=false.
# Prints `verify ok <version>`, or `verify failed: <check>` and exits 1.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-vm.sh
source "$here/lib-vm.sh"

[[ $# -le 1 ]] || forge_die "usage: verify.sh [<version>]"
vm_load_env
version="${1:-$(vm_read_version current-version)}"
[[ -n "$version" ]] || forge_die "no version: pass one or run load-and-start.sh first"
base="http://127.0.0.1:${FORGE_UI_PORT:-8095}"
timeout_s="${VERIFY_TIMEOUT_S:-90}"

fail() {
  echo "verify failed: $*" >&2
  exit 1
}

# wait_for <seconds> <command...>: retry the command every 2 s until it succeeds or time runs out.
wait_for() {
  local deadline=$((SECONDS + $1))
  shift
  until "$@"; do
    (( SECONDS < deadline )) || return 1
    sleep 2
  done
}

# answers <path> <code>: GET of the path returns that HTTP status.
answers() {
  [[ "$(vm_http_code "$base$1")" == "$2" ]]
}

# reported_version: the top-level "version" of GET /api/health.
reported_version() {
  vm_http_body "$base/api/health" | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 |
    sed -E 's/.*"([^"]*)"$/\1/'
}

# worker_healthy: the worker container's health check passes.
worker_healthy() {
  [[ "$(docker inspect traverse-forge-worker --format '{{.State.Health.Status}}' 2>/dev/null)" == healthy ]]
}

wait_for "$timeout_s" answers /api/health/ready 200 || fail "GET $base/api/health/ready is not 200 after ${timeout_s}s"
reported="$(reported_version || true)"
[[ "$reported" == "$version" ]] || fail "GET /api/health reports version '$reported', expected '$version'"
answers / 200 || fail "GET $base/ is not 200"
wait_for "$timeout_s" worker_healthy || fail "container traverse-forge-worker is not healthy"
if [[ "${FORGE_SWAGGER:-false}" == false ]]; then
  answers /api 404 || fail "GET $base/api (Swagger) is not 404 although FORGE_SWAGGER=false"
fi
echo "verify ok $version"
