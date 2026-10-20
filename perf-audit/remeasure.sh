#!/usr/bin/env bash
# Phase 2 helper: starts the instrumented API (current dist/) on :4014, runs the GET sweep for a route filter,
# prints the per-route summary, stops the API.
#   PERF_PASSWORD=… perf-audit/remeasure.sh <label> <route-filter> [roles] [warm]
set -euo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if command -v cygpath >/dev/null 2>&1; then ROOT="$(cygpath -m "$ROOT")"; fi
LABEL="$1"; FILTER="$2"; ROLES="${3:-Analyst}"; WARM="${4:-10}"
OUT="perf-audit/out/$LABEL"
mkdir -p perf-audit/out
stop_api() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*perf-audit*instrument.cjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Confirm:\$false }"
}
stop_api
trap stop_api EXIT
THROTTLE_LIMIT=100000000 PERF_OUT="$ROOT/$OUT-server.jsonl" bash perf-audit/start-api.sh > "$OUT-boot.log" 2>&1 &
until grep -qE "Application is running|Error:" "$OUT-boot.log" 2>/dev/null; do sleep 1; done
node perf-audit/bench-sweep.mjs --roles "$ROLES" --warm "$WARM" --filter "$FILTER" --out "$OUT-client.jsonl" > /dev/null
node perf-audit/report.mjs --client "$OUT-client.jsonl" --server "$OUT-server.jsonl" --json "$OUT-summary.json"
