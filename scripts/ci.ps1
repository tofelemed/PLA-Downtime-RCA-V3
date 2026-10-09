# Local CI: the same steps as .github/workflows/ci.yml, run sequentially against the local Postgres
# (server/pro-act-backend/.env; the integration harness uses the proact_test database).
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
$SmokeSpecs = @('e2e/auth.spec.ts', 'e2e/tasks.spec.ts', 'e2e/audit-auto-log.spec.ts')
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
  Invoke-Step 'Generated v2 API types match the OpenAPI snapshot' $Root { npm run api:types:check }
  Invoke-Step 'Lint backend' $Backend { npx eslint "{src,apps,libs,test}/**/*.ts" }
}

if (-not $SkipUnit) {
  Invoke-Step 'Backend unit tests' $Backend { npm run test:unit }
  Invoke-Step 'Backend fixture tests' $Backend { npm run test:fixtures }
  Invoke-Step 'Frontend unit tests' $Root { npm run test:run -- --exclude "src/test/integration/**" }
}

if (-not $SkipInt) {
  Invoke-Step 'Backend integration tests (local Postgres, proact_test)' $Backend { npm run test:int }
}

if ($E2E) {
  Invoke-Step 'E2E smoke suite' $Root { npx playwright test @SmokeSpecs }
}

$Elapsed = [int]((Get-Date) - $Started).TotalSeconds
Write-Host ""
Write-Host "CI steps passed in ${Elapsed}s" -ForegroundColor Green
