param([string[]]$Specs = @(), [ValidatePattern('^[a-zA-Z0-9-]+$')][string]$RunLabel = 'e2e')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$evidence = Join-Path $projectRoot "test-results/hdpe-audit/$RunLabel"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$env:E2E_PI_SIM_HOST = 'host.docker.internal'
$env:E2E_MQTT_PASSWORD_URL = 'mqtt://host.docker.internal:1885'
$env:E2E_MQTT_TLS_URL = 'mqtts://host.docker.internal:8885'
$env:E2E_MQTT_SIM_URL = 'mqtt://localhost:1885'
if ($Specs.Count -eq 0) { $Specs = @(rg --files e2e -g '*.spec.ts' | Sort-Object) }
$summary = @()
foreach ($spec in $Specs) {
    $spec = $spec.Replace('\', '/')
    $key = $spec.Replace('\', '-').Replace('/', '-').Replace('.spec.ts', '')
    $ready = $false
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4004/api/health' -NoProxy -TimeoutSec 10
            if ($health.status -eq 'healthy') { $ready = $true; break }
        } catch { docker start proact-postgres proact-mqtt-1 proact-backend-1 proact-worker-1 proact-frontend-1 2>&1 | Out-Null }
        Start-Sleep -Seconds 5
    }
    if (-not $ready) { throw "Stack unavailable before $spec; preserving results" }
    $env:PLAYWRIGHT_JSON_OUTPUT_FILE = Join-Path $evidence "$key.json"
    $log = Join-Path $evidence "$key.log"
    $artifacts = Join-Path $evidence "$key-artifacts"
    Write-Output "START $spec"
    & npx.cmd playwright test $spec --reporter=list,json --output=$artifacts *> $log
    $code = $LASTEXITCODE
    $summary += [pscustomobject]@{ spec = $spec; exitCode = $code; log = $log; json = $env:PLAYWRIGHT_JSON_OUTPUT_FILE }
    $summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence 'summary.json')
    Write-Output "END $spec exit=$code"
    Get-Content -LiteralPath $log -Tail 3
}
if ($summary | Where-Object { $_.exitCode -ne 0 }) { exit 1 }
