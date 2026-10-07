# Step-by-Step UI Integration Testing Script
# Tests UI components with backend endpoints

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  UI Integration Test - Step by Step" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

# Step 1: Check Backend Server
Write-Host "Step 1: Checking Backend Server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend server is running on port 4004" -ForegroundColor Green
    $backendRunning = $true
} catch {
    Write-Host "  ❌ Backend server is NOT running on port 4004" -ForegroundColor Red
    Write-Host "  ⚠️  Please start backend: cd server/pro-act-backend && npm run start:dev" -ForegroundColor Yellow
    $backendRunning = $false
}

# Step 2: Check Frontend Server
Write-Host "`nStep 2: Checking Frontend Server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8070" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Frontend server is running on port 8070" -ForegroundColor Green
    $frontendRunning = $true
} catch {
    Write-Host "  ❌ Frontend server is NOT running on port 8070" -ForegroundColor Red
    Write-Host "  ⚠️  Please start frontend: npm run dev" -ForegroundColor Yellow
    $frontendRunning = $false
}

# Step 3: Test Backend Health
Write-Host "`nStep 3: Testing Backend Health Endpoint..." -ForegroundColor Yellow
if ($backendRunning) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  ✅ Backend health check passed" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Backend health check failed (this is OK if endpoint doesn't exist)" -ForegroundColor Yellow
    }
}

# Step 4: Test API Documentation
Write-Host "`nStep 4: Checking API Documentation..." -ForegroundColor Yellow
if ($backendRunning) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4004/api" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.Content -like "*swagger*" -or $response.StatusCode -eq 200) {
            Write-Host "  ✅ API documentation accessible at http://localhost:4004/api" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  Could not access API docs (may require authentication)" -ForegroundColor Yellow
    }
}

# Step 5: Test Authentication Endpoint
Write-Host "`nStep 5: Testing Authentication Endpoint..." -ForegroundColor Yellow
if ($backendRunning) {
    try {
        $testLogin = @{
            email = "test@example.com"
            password = "test123"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:4004/api/auth/login" -Method POST -Body $testLogin -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
            Write-Host "  ✅ Authentication endpoint is accessible" -ForegroundColor Green
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 401) {
                Write-Host "  ✅ Authentication endpoint is accessible (401 = endpoint exists, credentials invalid)" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Authentication endpoint returned: $statusCode" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  ⚠️  Could not test authentication endpoint" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend Server:  $(if ($backendRunning) { '✅ Running' } else { '❌ Not Running' })" -ForegroundColor $(if ($backendRunning) { 'Green' } else { 'Red' })
Write-Host "Frontend Server: $(if ($frontendRunning) { '✅ Running' } else { '❌ Not Running' })" -ForegroundColor $(if ($frontendRunning) { 'Green' } else { 'Red' })

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open browser: http://localhost:8070" -ForegroundColor White
Write-Host "2. Open DevTools (press F12) - Network tab" -ForegroundColor White
Write-Host "3. Test login/registration" -ForegroundColor White
Write-Host "4. Verify API calls appear in Network tab" -ForegroundColor White
Write-Host "5. Check for errors in Console tab" -ForegroundColor White

Write-Host "`n📖 Full test plan: STEP_BY_STEP_UI_TEST_PLAN.md" -ForegroundColor Cyan
Write-Host ""

