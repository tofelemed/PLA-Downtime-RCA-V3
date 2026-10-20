#!/usr/bin/env bash
# Load-tests the hot page-load / polling endpoints (PERF_REPORT.md §2) one after the other.
#   PERF_PASSWORD=… perf-audit/load-top.sh [seconds-per-level]
set -euo pipefail
export MSYS_NO_PATHCONV=1
S="${1:-10}"
NOW=$(node -e 'const d=new Date(Math.floor(Date.now()/60000)*60000);console.log(d.toISOString())')
FROM=$(node -e "console.log(new Date(Date.parse('$NOW')-7*86400000).toISOString())")
W="from=$FROM&to=$NOW"
UNIT=$(docker exec proact-perf-postgres psql -U postgres -d proact -X -At -c "SELECT id FROM units LIMIT 1")
run() { node perf-audit/load.mjs --seconds "$S" --name "$1" --url "$2" --out perf-audit/out/load.jsonl; }
run identity-floor  "/api/v2/field-catalog"
run auth-profile    "/api/auth/profile"
run unread-count    "/api/v2/notifications/unread-count"
run events-list     "/api/v2/production-events?limit=20&sort=-startTime&physicalStates=open&physicalStates=closed&$W"
run current-stops   "/api/v2/production-events?limit=50&sort=-startTime&isOpen=true&physicalStates=open"
run downtime-report "/api/v2/reports/downtime?$W&groupBy=reason&metric=frequency"
run oee-report      "/api/v2/reports/oee?$W&groupBy=unit&policy=operational"
run recon-status    "/api/v2/reports/reconciliation-status?$W"
run approval-inbox  "/api/v2/approval-inbox?decidable=true&limit=20"
run rcas-list       "/api/v2/rcas?limit=20"
run period-summaries "/api/v2/period-summaries?unitIds=$UNIT&$W&limit=20"
