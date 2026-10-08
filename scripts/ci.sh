#!/usr/bin/env bash
# Local CI: the same steps as .github/workflows/ci.yml, run sequentially against the local Postgres
# (server/pro-act-backend/.env; the integration harness uses the proact_test database).
#
#   scripts/ci.sh [--e2e] [--skip-lint] [--skip-unit] [--skip-int]
#   npm run ci -- --e2e
#
# Dependencies must already be installed (npm ci --legacy-peer-deps in both projects).
# --e2e runs the Playwright smoke suite against the dev servers on 8070/4004 (started if not running).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/server/pro-act-backend"
SMOKE_SPECS=(e2e/auth.spec.ts e2e/tasks.spec.ts e2e/audit-auto-log.spec.ts)

RUN_LINT=1 RUN_UNIT=1 RUN_INT=1 RUN_E2E=0
for arg in "$@"; do
  case "$arg" in
    --e2e) RUN_E2E=1 ;;
    --skip-lint) RUN_LINT=0 ;;
    --skip-unit) RUN_UNIT=0 ;;
    --skip-int) RUN_INT=0 ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

STARTED=$(date +%s)
step() { printf '\n==> %s\n' "$*"; }

if [[ $RUN_LINT == 1 ]]; then
  step "Lint frontend"
  (cd "$ROOT" && npm run lint)
  step "Lint backend"
  (cd "$BACKEND" && npx eslint "{src,apps,libs,test}/**/*.ts")
fi

if [[ $RUN_UNIT == 1 ]]; then
  step "Backend unit tests"
  (cd "$BACKEND" && npm run test:unit)
  step "Backend fixture tests"
  (cd "$BACKEND" && npm run test:fixtures)
  step "Frontend unit tests"
  (cd "$ROOT" && npm run test:run -- --exclude "src/test/integration/**")
fi

if [[ $RUN_INT == 1 ]]; then
  step "Backend integration tests (local Postgres, proact_test)"
  (cd "$BACKEND" && npm run test:int)
fi

if [[ $RUN_E2E == 1 ]]; then
  step "E2E smoke suite"
  (cd "$ROOT" && npx playwright test "${SMOKE_SPECS[@]}")
fi

printf '\nCI steps passed in %ss\n' "$(( $(date +%s) - STARTED ))"
