# =============================================
# ProAct Backend - Automated Endpoint Testing
# PowerShell script to run all tests
# =============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ProAct Backend - Automated Testing" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"
$testsPassed = $true

# Check if backend is running
Write-Host "Checking backend server..." -ForegroundColor Yellow
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "  OK Backend server is running" -ForegroundColor Green
    }
} catch {
    Write-Host "  Warning: Backend server not detected on port 3000" -ForegroundColor Yellow
    Write-Host "  Tests will start the server automatically" -ForegroundColor Cyan
}

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host "Running E2E Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor Cyan

# Run E2E tests
npm run test:e2e
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Warning: Some E2E tests failed" -ForegroundColor Yellow
    $testsPassed = $false
}

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host "Running Unit Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor Cyan

# Run unit tests
npm run test
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Warning: Some unit tests failed" -ForegroundColor Yellow
    $testsPassed = $false
}

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host "Generating Coverage Report" -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor Cyan

# Run coverage
npm run test:cov
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Warning: Coverage generation had issues" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test Execution Complete" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

if ($testsPassed) {
    Write-Host "SUCCESS All tests passed!" -ForegroundColor Green
} else {
    Write-Host "WARNING Some tests failed. Please review output above." -ForegroundColor Yellow
}

Write-Host "`nCoverage Report:" -ForegroundColor Cyan
Write-Host "  File: coverage/lcov-report/index.html" -ForegroundColor White
Write-Host "`nTo view coverage report:" -ForegroundColor Yellow
Write-Host "  Start-Process coverage/lcov-report/index.html`n" -ForegroundColor White

Write-Host "========================================`n" -ForegroundColor Cyan

