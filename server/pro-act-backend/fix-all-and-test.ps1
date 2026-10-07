# Complete Fix and Test Script for ProAct Backend
# Fixes all entity types and runs tests

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ProAct Backend - Complete Fix & Test" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan

# Step 1: Fix entity types
Write-Host "Step 1: Fixing entity types for MSSQL..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "src/connectivity/entities" -Filter "*.entity.ts" -Recurse
$totalFixed = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix boolean types
    $content = $content -replace "type: 'boolean'", "type: 'bit'"
    
    # Fix json types  
    $content = $content -replace "type: 'json'", "type: 'simple-json'"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  OK Fixed: $($file.Name)" -ForegroundColor Green
        $totalFixed++
    }
}

Write-Host "  Total files fixed: $totalFixed" -ForegroundColor Cyan

# Step 2: Clean build
Write-Host "`nStep 2: Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "  OK Removed dist folder" -ForegroundColor Green
}

# Step 3: Clear Jest cache
Write-Host "`nStep 3: Clearing Jest cache..." -ForegroundColor Yellow
npx jest --clearCache 2>$null
Write-Host "  OK Jest cache cleared" -ForegroundColor Green

# Step 4: Run tests
Write-Host "`nStep 4: Running E2E tests..." -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan

npm run test:e2e

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  Test Execution Complete!" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan

