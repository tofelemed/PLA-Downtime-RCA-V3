# Simple script to start Backend and Frontend in sequence
# Run this from the project root directory

$ErrorActionPreference = "Continue"

# Get current directory
$currentDir = Get-Location
Write-Host "`nCurrent directory: $currentDir" -ForegroundColor Gray

# Find project root (directory with both package.json and server/pro-act-backend/package.json)
$projectRoot = $currentDir
$foundRoot = $false

# Check if we're in the right place
if ((Test-Path "package.json") -and (Test-Path "server\pro-act-backend\package.json")) {
    $foundRoot = $true
    Write-Host "✅ Found project root: $projectRoot" -ForegroundColor Green
} else {
    Write-Host "⚠️ Looking for project root..." -ForegroundColor Yellow
    # Try parent directory
    $parentDir = Split-Path -Parent $currentDir
    if ((Test-Path (Join-Path $parentDir "package.json")) -and (Test-Path (Join-Path $parentDir "server\pro-act-backend\package.json"))) {
        $projectRoot = $parentDir
        Set-Location $projectRoot
        $foundRoot = $true
        Write-Host "✅ Found project root: $projectRoot" -ForegroundColor Green
    }
}

if (-not $foundRoot) {
    Write-Host "`n❌ ERROR: Could not find project root directory!" -ForegroundColor Red
    Write-Host "Please run this script from the project root (where package.json exists)" -ForegroundColor Yellow
    Write-Host "Current directory: $currentDir" -ForegroundColor Gray
    exit 1
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Starting ProAct Servers in Sequence" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Step 1: Start Backend
Write-Host "Step 1: Starting Backend Server..." -ForegroundColor Yellow

$backendPath = Join-Path $projectRoot "server\pro-act-backend"
Write-Host "  📁 Backend directory: $backendPath" -ForegroundColor Gray

if (-not (Test-Path "$backendPath\package.json")) {
    Write-Host "  ❌ Backend package.json not found!" -ForegroundColor Red
    exit 1
}

# Create backend startup command
$backendScript = @"
Set-Location '$backendPath'
Write-Host '🚀 Starting Backend Server on port 4004...' -ForegroundColor Green
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
`$env:PORT = '4004'
npm run start:dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal
Write-Host "  ✅ Backend server starting in new window" -ForegroundColor Green

# Wait for backend
Write-Host "`n⏳ Waiting 45 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

# Check backend
Write-Host "Checking backend status..." -ForegroundColor Cyan
$backendReady = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend is running on port 4004!" -ForegroundColor Green
    $backendReady = $true
} catch {
    Write-Host "  ⏳ Backend still starting... (may need more time)" -ForegroundColor Yellow
    Write-Host "  ℹ️  Check the backend terminal window for status" -ForegroundColor Gray
}

# Step 2: Start Frontend
Write-Host "`nStep 2: Starting Frontend Server..." -ForegroundColor Yellow
Write-Host "  📁 Frontend directory: $projectRoot" -ForegroundColor Gray

if (-not (Test-Path "$projectRoot\package.json")) {
    Write-Host "  ❌ Frontend package.json not found!" -ForegroundColor Red
    exit 1
}

# Create frontend startup command
$frontendScript = @"
Set-Location '$projectRoot'
Write-Host '🚀 Starting Frontend Server on port 8070...' -ForegroundColor Green
Write-Host 'Directory: ' -NoNewline; Write-Host `$PWD -ForegroundColor Gray
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Normal
Write-Host "  ✅ Frontend server starting in new window" -ForegroundColor Green

# Wait a bit
Start-Sleep -Seconds 5

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Server Status" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend:  $(if ($backendReady) { '✅ Running on port 4004' } else { '⏳ Starting...' })" -ForegroundColor $(if ($backendReady) { 'Green' } else { 'Yellow' })
Write-Host "Frontend: ⏳ Starting on port 8070..." -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for backend: 'Application is running on: http://localhost:4004'" -ForegroundColor White
Write-Host "2. Wait for frontend: 'Local: http://localhost:8070/'" -ForegroundColor White
Write-Host "3. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "4. Try login when both servers are ready!`n" -ForegroundColor White

