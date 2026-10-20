#!/usr/bin/env bash
# Starts the built API (server/pro-act-backend/dist) on :4014 against the perf clone (127.0.0.1:5435),
# instrumented by perf-audit/instrument.cjs. Same role and NODE_ENV as the deployed API container; no
# migrations, no schedulers. Extra args go to node (e.g. --cpu-prof --cpu-prof-dir=perf-audit/out/prof).
#   PERF_OUT=perf-audit/out/run1.jsonl PERF_SQL=1 perf-audit/start-api.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Git Bash: hand node a Windows path (MSYS path conversion may be off)
if command -v cygpath >/dev/null 2>&1; then ROOT="$(cygpath -m "$ROOT")"; fi
cd "$ROOT/server/pro-act-backend"
export NODE_ENV=production PROCESS_ROLE=api PORT=4014 DB_MIGRATIONS_RUN=false \
  DB_HOST=127.0.0.1 DB_PORT=5435 DB_USERNAME=postgres DB_PASSWORD=postgres DB_NAME=proact
export PERF_OUT="${PERF_OUT:-$ROOT/perf-audit/out/requests.jsonl}"
exec node "$@" -r "$ROOT/perf-audit/instrument.cjs" dist/src/main.js
