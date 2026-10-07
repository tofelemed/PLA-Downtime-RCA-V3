# Fix Entity Types for MSSQL Compatibility
# Changes 'boolean' to 'bit' and 'json' to 'simple-json' in all connectivity entities

Write-Host "`nFixing entity types for MSSQL compatibility..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "src/connectivity/entities" -Filter "*.entity.ts" -Recurse

$totalFixed = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Replace type: 'boolean' with type: 'bit'
    $content = $content -replace "type: 'boolean'", "type: 'bit'"
    
    # Replace type: 'json' with type: 'simple-json' (MSSQL compatible)
    $content = $content -replace "type: 'json'", "type: 'simple-json'"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  OK Fixed: $($file.Name)" -ForegroundColor Green
        $totalFixed++
    }
}

Write-Host "`nTotal files fixed: $totalFixed" -ForegroundColor Cyan
Write-Host "Entity types are now MSSQL compatible!`n" -ForegroundColor Green

