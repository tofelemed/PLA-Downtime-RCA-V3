param(
    [string]$ApiBase = 'http://127.0.0.1:4004/api',
    [string]$Email = 'sara.nouri@demo.acme.com',
    [string]$Password = 'Persona-2026!demo',
    [string]$EvidenceDirectory = 'test-results/hdpe-audit'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$evidence = [IO.Path]::GetFullPath((Join-Path $projectRoot $EvidenceDirectory))
if (-not $evidence.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Evidence directory must be inside the project workspace.'
}
if (([Uri]$ApiBase).Host -notin @('localhost','127.0.0.1')) { throw 'This acceptance runner is for the local HDPE stack only.' }
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$login = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method Post -ContentType 'application/json' -NoProxy -TimeoutSec 30 -Body (@{ email=$Email; password=$Password } | ConvertTo-Json)
$token = $login.accessToken
if (-not $token) { $token = $login.access_token }
if (-not $token) { throw 'Login did not return an access token.' }
$headers = @{ Authorization="Bearer $token"; 'X-Tenant-Id'=$login.user.tenantId }
function Read-Api([string]$Path) {
    Invoke-RestMethod -Uri "$ApiBase$Path" -Headers $headers -NoProxy -TimeoutSec 30
}
function Invoke-Sql([string]$Name, [string[]]$Variables = @()) {
    $localFile = Join-Path $PSScriptRoot "$Name.sql"
    & docker cp $localFile "proact-postgres:/tmp/$Name.sql"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy $Name.sql to the local database container." }
    & docker exec proact-postgres psql -U postgres -d proact -X @Variables -f "/tmp/$Name.sql" *> (Join-Path $evidence "$Name.txt")
    if ($LASTEXITCODE -ne 0) { throw "$Name failed; inspect $evidence/$Name.txt" }
    Write-Output "$Name passed"
}
$currentMonth = Read-Api '/v2/month-closes/current'
$previousMonth = Read-Api "/v2/month-closes/$($currentMonth.previousMonthKey)"
@{ current=$currentMonth; previous=$previousMonth } | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $evidence 'final-month-readback.json')
Invoke-Sql -Name 'hdpe-final-verify' -Variables @(
    '-v',"hdpe_current_month_first_date=$($currentMonth.firstDate)",
    '-v',"hdpe_current_month_end_date=$($currentMonth.endDate)",
    '-v',"hdpe_previous_month_first_date=$($previousMonth.firstDate)"
)
Invoke-Sql -Name 'hdpe-db-audit'
Invoke-Sql -Name 'hdpe-ingestion-verify'
$signals = Read-Api '/v2/signals?limit=200'
$previews = @()
foreach ($sourceKey in @('F1DPwebid-throughput','DEMO-HDPE-unit200-pellet-rate')) {
    $signal = $signals.items | Where-Object sourceKey -eq $sourceKey
    if (@($signal).Count -ne 1) { throw "Expected one signal for $sourceKey" }
    # SQL has independently verified the exact finite sample window and integration.
    $signalId = ([guid]$signal.id).ToString()
    $bounds = & docker exec proact-postgres psql -U postgres -d proact -X -At -c "SELECT min(observed_at),max(observed_at) FROM measurement_samples WHERE signal_id='$signalId'::uuid"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read telemetry bounds.' }
    $dates = $bounds.Split('|')
    $body = @{ from=([datetimeoffset]::Parse($dates[0])).ToString('o'); to=([datetimeoffset]::Parse($dates[1])).ToString('o') } | ConvertTo-Json
    $headers['Idempotency-Key'] = [guid]::NewGuid().ToString()
    $preview = Invoke-RestMethod -Uri "$ApiBase/v2/signals/$signalId/preview" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -NoProxy -TimeoutSec 30
    $expectedQuantity = if ($sourceKey -eq 'F1DPwebid-throughput') { 50.4 } else { 45.5 }
    if ([decimal]$preview.result.quantity -ne $expectedQuantity) { throw "Unexpected API-integrated quantity for $sourceKey" }
    $previews += @{ sourceKey=$sourceKey; preview=$preview }
}
$previews | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $evidence 'final-signal-previews.json')
Write-Output 'Final HDPE hierarchy, permissions, accounting, month-close and MQTT acceptance passed.'
