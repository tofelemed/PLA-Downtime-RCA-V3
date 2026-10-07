# Start Backend and Frontend Servers in Sequence
# This script starts backend first, waits for it to be ready, then starts frontend

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting ProAct Servers in Sequence" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

# Step 1: Start Backend Server
Write-Host "Step 1: Starting Backend Server..." -ForegroundColor Yellow
Write-Host "Opening backend server in new window..." -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "server\pro-act-backend"
$backendScript = "Write-Host 'Starting Backend Server on port 4004...' -ForegroundColor Cyan; `$env:PORT='4004'; npm run start:dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; $backendScript" -WindowStyle Normal

Write-Host "  ✅ Backend server starting in new window" -ForegroundColor Green
Write-Host "  ⏳ Waiting for backend to be ready..." -ForegroundColor Yellow

# Wait and check for backend
$backendReady = $false
$maxAttempts = 12
$attempt = 0

while (-not $backendReady -and $attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 5
    $attempt++
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  ✅ Backend is running on port 4004!" -ForegroundColor Green
        $backendReady = $true
    } catch {
        Write-Host "  ⏳ Waiting for backend... (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
    }
}

if (-not $backendReady) {
    Write-Host "  ⚠️  Backend is taking longer than expected" -ForegroundColor Yellow
    Write-Host "  ℹ️  Backend may still be starting. Check the backend terminal window." -ForegroundColor Yellow
    Write-Host "  ℹ️  You can start frontend manually when backend is ready." -ForegroundColor Yellow
}

# Step 2: Start Frontend Server
Write-Host "`nStep 2: Starting Frontend Server..." -ForegroundColor Yellow
Write-Host "Opening frontend server in new window..." -ForegroundColor Cyan

$frontendPath = $PSScriptRoot
$frontendScript = "Write-Host 'Starting Frontend Server on port 8070...' -ForegroundColor Cyan; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; $frontendScript" -WindowStyle Normal

Write-Host "  ✅ Frontend server starting in new window" -ForegroundColor Green

# Wait a moment for frontend to start
Start-Sleep -Seconds 3

# Check frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8070" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Frontend is running on port 8070!" -ForegroundColor Green
} catch {
    Write-Host "  ⏳ Frontend is starting... (may take a few seconds)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Server Status" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  $(if ($backendReady) { '✅ Running on port 4004' } else { '⏳ Starting... (check terminal window)' })" -ForegroundColor $(if ($backendReady) { 'Green' } else { 'Yellow' })
Write-Host "Frontend: ⏳ Starting... (check terminal window)" -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for backend to fully start (30-60 seconds)" -ForegroundColor White
Write-Host "2. Wait for frontend to fully start (5-10 seconds)" -ForegroundColor White
Write-Host "3. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "4. Try login!" -ForegroundColor White

Write-Host "`n📖 Check terminal windows for startup messages" -ForegroundColor Cyan
Write-Host ""

