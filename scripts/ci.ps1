# Local CI: the same steps as .github/workflows/ci.yml, run sequentially; integration tests use a throwaway
# Postgres container (docker-compose.testdb.yml, 127.0.0.1:5434, database proact_test), removed afterwards.
#
#   powershell -ExecutionPolicy Bypass -File scripts/ci.ps1 [-E2E] [-SkipLint] [-SkipUnit] [-SkipInt]
#   npm run ci -- --e2e
#
# Dependencies must already be installed (npm ci --legacy-peer-deps in both projects).
# -E2E runs the Playwright smoke suite against the dev servers on 8070/4004 (started if not running).
[CmdletBinding()]
param(
  [switch]$E2E,
  [switch]$SkipLint,
  [switch]$SkipUnit,
  [switch]$SkipInt
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'server\pro-act-backend'
$SmokeSpecs = @('e2e/auth.spec.ts', 'e2e/tasks.spec.ts', 'e2e/audit-auto-log.spec.ts', 'e2e/event-verification-d13.spec.ts', 'e2e/plan-dashboard-ux05.spec.ts', 'e2e/rca-integration-rca01-03.spec.ts')
$Started = Get-Date

function Invoke-Step {
  param([string]$Name, [string]$Directory, [scriptblock]$Command)
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  Push-Location $Directory
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Step failed ($LASTEXITCODE): $Name" }
  } finally {
    Pop-Location
  }
}

if (-not $SkipLint) {
  Invoke-Step 'Lint frontend' $Root { npm run lint }
  Invoke-Step 'Typecheck frontend (app, tests, e2e, configs)' $Root { npm run typecheck }
  Invoke-Step 'Generated v2 API types match the OpenAPI snapshot' $Root { npm run api:types:check }
  Invoke-Step 'Lint backend' $Backend { npx eslint "{src,apps,libs,test}/**/*.ts" }
}

if (-not $SkipUnit) {
  Invoke-Step 'Backend unit tests' $Backend { npm run test:unit }
  Invoke-Step 'Backend fixture tests' $Backend { npm run test:fixtures }
  Invoke-Step 'Frontend unit tests' $Root { npm run test:run -- --exclude "src/test/integration/**" }
}

if (-not $SkipInt) {
  try {
    Invoke-Step 'Backend integration tests (throwaway Postgres on 127.0.0.1:5434, proact_test)' $Backend { npm run test:int }
  } finally {
    Push-Location $Backend
    npm run testdb:down | Out-Null
    Pop-Location
  }
}

if ($E2E) {
  Invoke-Step 'E2E smoke suite' $Root { npx playwright test @SmokeSpecs }
}

$Elapsed = [int]((Get-Date) - $Started).TotalSeconds
Write-Host ""
Write-Host "CI steps passed in ${Elapsed}s" -ForegroundColor Green
