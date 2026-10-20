#!/usr/bin/env bash
# P03: the same load (4 report endpoints, concurrency 16, 10 s, two repeats) with the API started at
# DB_POOL_MAX=<n>.   PERF_PASSWORD=… perf-audit/load-pool.sh <pool-size>
set -uo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ROOTW="$ROOT"; if command -v cygpath >/dev/null 2>&1; then ROOTW="$(cygpath -m "$ROOT")"; fi
POOL="$1"
stop_api() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*perf-audit*instrument.cjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Confirm:\$false }"
}
stop_api; trap stop_api EXIT
(DB_POOL_MAX="$POOL" THROTTLE_LIMIT=100000000 PERF_OUT="$ROOTW/perf-audit/out/pool$POOL-server.jsonl" bash perf-audit/start-api.sh > "perf-audit/out/pool$POOL-boot.log" 2>&1 &)
until grep -qE "Application is running|Error:" "perf-audit/out/pool$POOL-boot.log" 2>/dev/null; do sleep 1; done
NOW=$(node -e 'console.log(new Date(Math.floor(Date.now()/60000)*60000).toISOString())')
FROM=$(node -e "console.log(new Date(Date.parse('$NOW')-7*86400000).toISOString())")
W="from=$FROM&to=$NOW"
UNIT=$(docker exec proact-perf-postgres psql -U postgres -d proact -X -At -c "SELECT id FROM units LIMIT 1")
for rep in 1 2; do
  for spec in "downtime|/api/v2/reports/downtime?$W&groupBy=reason&metric=frequency" \
              "recon-status|/api/v2/reports/reconciliation-status?$W" \
              "period-summaries|/api/v2/period-summaries?unitIds=$UNIT&$W&limit=20" \
              "oee|/api/v2/reports/oee?$W&groupBy=unit&policy=operational"; do
    node perf-audit/load.mjs --seconds 10 --levels 16 --name "pool$POOL-${spec%%|*}" --url "${spec#*|}" \
      --out "perf-audit/out/pool-load.jsonl"
  done
done
