#!/usr/bin/env bash
# Starts the instrumented API (current dist/), runs GET probes as SuperAdmin and prints status, rows and bytes
# per URL, then stops the API.   PERF_PASSWORD=… perf-audit/probe.sh <label> <path>...
set -uo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ROOTW="$ROOT"; if command -v cygpath >/dev/null 2>&1; then ROOTW="$(cygpath -m "$ROOT")"; fi
LABEL="$1"; shift
stop_api() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*perf-audit*instrument.cjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Confirm:\$false }"
}
stop_api; trap stop_api EXIT
(THROTTLE_LIMIT=100000000 PERF_OUT="$ROOTW/perf-audit/out/$LABEL-server.jsonl" bash perf-audit/start-api.sh > "perf-audit/out/$LABEL-boot.log" 2>&1 &)
until grep -qE "Application is running|Error:" "perf-audit/out/$LABEL-boot.log" 2>/dev/null; do sleep 1; done
EMAIL=$(docker exec proact-perf-postgres psql -U postgres -d proact -X -At -c "SELECT email FROM users WHERE role='SuperAdmin' LIMIT 1")
TOKEN=$(curl -s -X POST http://127.0.0.1:4014/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PERF_PASSWORD\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).access_token))')
for path in "$@"; do
  body=$(curl -s -H "Authorization: Bearer $TOKEN" -w '\n%{http_code}' "http://127.0.0.1:4014$path")
  code=$(tail -n1 <<<"$body"); json=$(sed '$d' <<<"$body")
  rows=$(node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(Array.isArray(b)?b.length:Array.isArray(b.items)?b.items.length:"-")' <<<"$json" 2>/dev/null)
  echo "$LABEL $code rows=$rows bytes=${#json} $path"
done
