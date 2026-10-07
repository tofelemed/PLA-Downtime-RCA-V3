# Start Backend and Frontend Servers in Sequence
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting ProAct Servers" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Get the project root directory
$projectRoot = $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = Get-Location
}

# Step 1: Start Backend
Write-Host "Step 1: Starting Backend Server..." -ForegroundColor Yellow
$backendPath = Join-Path $projectRoot "server\pro-act-backend"
$backendCommand = "cd '$backendPath'; `$env:PORT='4004'; npm run start:dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand -WindowStyle Normal
Write-Host "  ✅ Backend server starting in new window (port 4004)" -ForegroundColor Green

# Step 2: Wait for backend
Write-Host "`n⏳ Waiting 30 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check backend status
Write-Host "`nChecking backend status..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend is running on port 4004!" -ForegroundColor Green
    $backendReady = $true
} catch {
    Write-Host "  ⏳ Backend still starting... (may need more time)" -ForegroundColor Yellow
    Write-Host "  ℹ️  Check the backend terminal window for status" -ForegroundColor Gray
    $backendReady = $false
}

# Step 3: Start Frontend
Write-Host "`nStep 2: Starting Frontend Server..." -ForegroundColor Yellow
$frontendCommand = "cd '$projectRoot'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand -WindowStyle Normal
Write-Host "  ✅ Frontend server starting in new window (port 8070)" -ForegroundColor Green

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
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  $(if ($backendReady) { '✅ Running on port 4004' } else { '⏳ Starting... (check terminal)' })" -ForegroundColor $(if ($backendReady) { 'Green' } else { 'Yellow' })
Write-Host "Frontend: ⏳ Starting... (check terminal)" -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for both servers to fully start" -ForegroundColor White
Write-Host "2. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "3. Check backend terminal for: 'Application is running on...'" -ForegroundColor White
Write-Host "4. Try login when backend is ready!`n" -ForegroundColor White

