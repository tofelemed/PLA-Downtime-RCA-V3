# Start Backend and Frontend Servers in Sequence
# Run this from the project root directory

$ErrorActionPreference = "Continue"

# Set project root path (adjust if needed)
$projectRoot = "C:\apm\nw-pro-act\nw-pro-act\pro-act_19-11-2025-backendIntegrated_bck\pro-act_05-05-2025_12-47PM-working\pro-act_21-07-2025_10-36PM\pro-act"

# Verify paths
if (-not (Test-Path $projectRoot)) {
    Write-Host "`n❌ ERROR: Project root not found: $projectRoot" -ForegroundColor Red
    Write-Host "Please update the `$projectRoot variable in this script with the correct path" -ForegroundColor Yellow
    exit 1
}

Set-Location $projectRoot

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting ProAct Servers in Sequence" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan
Write-Host "Project root: $projectRoot" -ForegroundColor Gray

# Verify backend exists
$backendPath = Join-Path $projectRoot "server\pro-act-backend"
if (-not (Test-Path "$backendPath\package.json")) {
    Write-Host "`n❌ ERROR: Backend not found at: $backendPath" -ForegroundColor Red
    exit 1
}

# Verify frontend exists
if (-not (Test-Path "$projectRoot\package.json")) {
    Write-Host "`n❌ ERROR: Frontend not found at: $projectRoot" -ForegroundColor Red
    exit 1
}

# Step 1: Start Backend
Write-Host "Step 1: Starting Backend Server on port 4004..." -ForegroundColor Yellow
Write-Host "  📁 Backend: $backendPath" -ForegroundColor Gray

$backendCmd = @"
Set-Location '$backendPath'
Write-Host '🚀 Starting Backend Server...' -ForegroundColor Green
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
`$env:PORT = '4004'
npm run start:dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Write-Host "  ✅ Backend server starting in new window" -ForegroundColor Green

# Wait for backend
Write-Host "`n⏳ Waiting 50 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 50

# Check backend
Write-Host "Checking backend status..." -ForegroundColor Cyan
$backendReady = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend is running on port 4004!" -ForegroundColor Green
    $backendReady = $true
} catch {
    Write-Host "  ⏳ Backend still starting... (may need more time)" -ForegroundColor Yellow
    Write-Host "  ℹ️  Check backend terminal window for status" -ForegroundColor Gray
}

# Step 2: Start Frontend
Write-Host "`nStep 2: Starting Frontend Server on port 8070..." -ForegroundColor Yellow
Write-Host "  📁 Frontend: $projectRoot" -ForegroundColor Gray

$frontendCmd = @"
Set-Location '$projectRoot'
Write-Host '🚀 Starting Frontend Server...' -ForegroundColor Green
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
Write-Host "  ✅ Frontend server starting in new window" -ForegroundColor Green

# Wait a bit
Start-Sleep -Seconds 5

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Server Status" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  $(if ($backendReady) { '✅ Running on port 4004' } else { '⏳ Starting... (check terminal)' })" -ForegroundColor $(if ($backendReady) { 'Green' } else { 'Yellow' })
Write-Host "Frontend: ⏳ Starting on port 8070... (check terminal)" -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for backend message: 'Application is running on: http://localhost:4004'" -ForegroundColor White
Write-Host "2. Wait for frontend message: 'Local: http://localhost:8070/'" -ForegroundColor White
Write-Host "3. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "4. Try login when both servers are ready!`n" -ForegroundColor White

Write-Host "📖 Monitor terminal windows for startup progress and any errors`n" -ForegroundColor Cyan

