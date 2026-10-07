# Start Backend and Frontend Servers
# Run from project root

$ErrorActionPreference = "Continue"

$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "server\pro-act-backend"

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting Backend and Frontend Servers" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Step 1: Start Backend
Write-Host "Step 1: Starting Backend Server (port 4004)..." -ForegroundColor Yellow

$backendScript = "cd '$backendPath'; `$env:PORT='4004'; Write-Host 'Backend starting on port 4004...' -ForegroundColor Green; npm run start:dev"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $backendScript)
Write-Host "  Backend server starting in new window" -ForegroundColor Green

# Wait for backend
Write-Host "`nWaiting 45 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

# Step 2: Start Frontend
Write-Host "`nStep 2: Starting Frontend Server (port 8070)..." -ForegroundColor Yellow

$frontendScript = "cd '$projectRoot'; Write-Host 'Frontend starting on port 8070...' -ForegroundColor Green; npm run dev"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontendScript)
Write-Host "  Frontend server starting in new window" -ForegroundColor Green

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Servers Starting!" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  Starting on port 4004 (check terminal window)" -ForegroundColor Yellow
Write-Host "Frontend: Starting on port 8070 (check terminal window)" -ForegroundColor Yellow

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for backend: 'Application is running on: http://localhost:4004'" -ForegroundColor White
Write-Host "2. Wait for frontend: 'Local: http://localhost:8070/'" -ForegroundColor White
Write-Host "3. Open browser: http://localhost:8070`n" -ForegroundColor White

