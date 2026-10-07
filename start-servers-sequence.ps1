# Start Backend and Frontend Servers in Sequence
# This script ensures correct directories and proper startup

$ErrorActionPreference = "Continue"

# Get the script directory (project root)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    $scriptPath = Get-Location
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting ProAct Servers in Sequence" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan
Write-Host "Project root: $scriptPath" -ForegroundColor Gray

# Step 1: Start Backend Server
Write-Host "Step 1: Starting Backend Server on port 4004..." -ForegroundColor Yellow

$backendPath = Join-Path $scriptPath "server\pro-act-backend"
if (-not (Test-Path $backendPath)) {
    Write-Host "  ❌ Backend directory not found: $backendPath" -ForegroundColor Red
    exit 1
}

Write-Host "  📁 Backend path: $backendPath" -ForegroundColor Gray

# Start backend in new window
$backendScript = @"
cd '$backendPath'
Write-Host '🚀 Starting Backend Server on port 4004...' -ForegroundColor Cyan
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
`$env:PORT='4004'
npm run start:dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal
Write-Host "  ✅ Backend server starting in new window" -ForegroundColor Green

# Step 2: Wait for backend
Write-Host "`n⏳ Waiting 40 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 40

# Check backend status
Write-Host "`nChecking backend status..." -ForegroundColor Cyan
$backendReady = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend is running on port 4004!" -ForegroundColor Green
    $backendReady = $true
} catch {
    Write-Host "  ⏳ Backend still starting... checking port 3000..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  ✅ Backend is running on port 3000" -ForegroundColor Green
        Write-Host "  ⚠️  Frontend expects port 4004 - update frontend .env if needed" -ForegroundColor Yellow
        $backendReady = $true
    } catch {
        Write-Host "  ⏳ Backend still starting... (this is normal, may take 60+ seconds)" -ForegroundColor Yellow
        Write-Host "  ℹ️  Check the backend terminal window for startup progress" -ForegroundColor Gray
    }
}

# Step 3: Start Frontend Server
Write-Host "`nStep 2: Starting Frontend Server on port 8070..." -ForegroundColor Yellow

$frontendPath = $scriptPath
if (-not (Test-Path (Join-Path $frontendPath "package.json"))) {
    Write-Host "  ❌ Frontend package.json not found in: $frontendPath" -ForegroundColor Red
    exit 1
}

Write-Host "  📁 Frontend path: $frontendPath" -ForegroundColor Gray

# Start frontend in new window
$frontendScript = @"
cd '$frontendPath'
Write-Host '🚀 Starting Frontend Server on port 8070...' -ForegroundColor Cyan
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Normal
Write-Host "  ✅ Frontend server starting in new window" -ForegroundColor Green

# Wait a moment
Start-Sleep -Seconds 5

# Check frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8070" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Frontend is running on port 8070!" -ForegroundColor Green
} catch {
    Write-Host "  ⏳ Frontend is starting... (may take a few seconds)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Server Status Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  $(if ($backendReady) { '✅ Running' } else { '⏳ Starting... (check terminal window)' })" -ForegroundColor $(if ($backendReady) { 'Green' } else { 'Yellow' })
Write-Host "Frontend: ⏳ Starting... (check terminal window)" -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for backend to show: 'Application is running on...'" -ForegroundColor White
Write-Host "2. Wait for frontend to show: 'Local: http://localhost:8070/'" -ForegroundColor White
Write-Host "3. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "4. Try login when both servers are ready!`n" -ForegroundColor White

Write-Host "📖 Check terminal windows for startup messages and any errors`n" -ForegroundColor Cyan

