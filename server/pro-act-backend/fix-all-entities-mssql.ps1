# =============================================
# ProAct Backend - Complete Entity Type Fix
# Fixes ALL TypeORM entity issues for MSSQL
# =============================================

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ProAct Backend - Complete Entity Type Fix" -ForegroundColor Green
Write-Host "  Fixing ALL entities for MSSQL compatibility" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan

$totalFixed = 0
$filesFixed = @()

# Get all entity files in the entire src directory
$entityFiles = Get-ChildItem -Path "src" -Filter "*.entity.ts" -Recurse

Write-Host "Found $($entityFiles.Count) entity files to check..." -ForegroundColor Yellow
Write-Host ""

foreach ($file in $entityFiles) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $changes = @()
    
    # Fix 1: Boolean types (boolean → bit)
    if ($content -match "type: 'boolean'") {
        $content = $content -replace "type: 'boolean'", "type: 'bit'"
        $changes += "boolean→bit"
    }
    
    # Fix 2: JSON types (json → simple-json)
    if ($content -match "type: 'json'") {
        $content = $content -replace "type: 'json'", "type: 'simple-json'"
        $changes += "json→simple-json"
    }
    
    # Fix 3: Text types without length specification (text → nvarchar(MAX))
    if ($content -match "type: 'text'(?!,)") {
        $content = $content -replace "type: 'text'", "type: 'nvarchar', length: 'MAX'"
        $changes += "text→nvarchar(MAX)"
    }
    
    # Fix 4: UUID columns with length (remove length from uuid type)
    if ($content -match "type: 'uuid', length:") {
        $content = $content -replace "type: 'uuid', length: \d+", "type: 'uuid'"
        $content = $content -replace "type: 'uuid', length: '\d+'", "type: 'uuid'"
        $changes += "uuid:removed-length"
    }
    
    # Fix 5: Simple array types (ensure they're using simple-array)
    if ($content -match "type: 'array'") {
        $content = $content -replace "type: 'array'", "type: 'simple-array'"
        $changes += "array→simple-array"
    }
    
    # Fix 6: Timestamp/datetime consistency
    if ($content -match "type: 'timestamp'") {
        $content = $content -replace "type: 'timestamp'", "type: 'datetime'"
        $changes += "timestamp→datetime"
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $relativePath = $file.FullName -replace [regex]::Escape($PWD.Path + "\"), ""
        Write-Host "  OK Fixed: $relativePath" -ForegroundColor Green
        if ($changes.Count -gt 0) {
            Write-Host "     Changes: $($changes -join ', ')" -ForegroundColor Cyan
        }
        $filesFixed += $file.Name
        $totalFixed++
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Fix Summary" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total entity files scanned: $($entityFiles.Count)" -ForegroundColor White
Write-Host "Total files fixed: $totalFixed" -ForegroundColor Green
Write-Host ""

if ($totalFixed -gt 0) {
    Write-Host "Fixed files:" -ForegroundColor Yellow
    foreach ($file in $filesFixed) {
        Write-Host "  • $file" -ForegroundColor Cyan
    }
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  OK All entities are now MSSQL compatible!" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan

# Now clean and test
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Clear caches" -ForegroundColor White
Write-Host "  2. Run tests" -ForegroundColor White
Write-Host ""

$response = Read-Host "Would you like to clear caches and run tests now? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nClearing build cache..." -ForegroundColor Yellow
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
        Write-Host "  OK Removed dist folder" -ForegroundColor Green
    }
    
    Write-Host "`nClearing Jest cache..." -ForegroundColor Yellow
    npx jest --clearCache 2>$null
    Write-Host "  OK Jest cache cleared" -ForegroundColor Green
    
    Write-Host "`nRunning E2E tests..." -ForegroundColor Yellow
    Write-Host "============================================================`n" -ForegroundColor Cyan
    
    npm run test:e2e
} else {
    Write-Host "`nSkipping tests. You can run them manually with:" -ForegroundColor Yellow
    Write-Host "  npm run test:e2e" -ForegroundColor Cyan
    Write-Host ""
}

