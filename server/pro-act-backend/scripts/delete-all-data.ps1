# PowerShell script to delete all data from database
# Usage: .\delete-all-data.ps1

Write-Host "⚠️  WARNING: This will DELETE ALL DATA from the database!" -ForegroundColor Red
Write-Host "⚠️  This action is IRREVERSIBLE!" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Type 'DELETE ALL' to confirm"

if ($confirmation -ne "DELETE ALL") {
    Write-Host "❌ Deletion cancelled." -ForegroundColor Yellow
    exit
}

# Get database connection details from environment or use defaults
$dbHost = $env:DB_HOST ?? "localhost"
$dbPort = $env:DB_PORT ?? "1433"
$dbUsername = $env:DB_USERNAME ?? "sa"
$dbPassword = $env:DB_PASSWORD ?? ""
$dbName = $env:DB_NAME ?? "ProActDB"

Write-Host "📋 Database: $dbName on $dbHost`:$dbPort" -ForegroundColor Cyan
Write-Host "🗑️  Executing delete script..." -ForegroundColor Yellow

# SQL script path
$sqlScript = Join-Path $PSScriptRoot "..\database-setup\delete-all-data.sql"

if (-not (Test-Path $sqlScript)) {
    Write-Host "❌ SQL script not found: $sqlScript" -ForegroundColor Red
    exit 1
}

# Run SQL script using sqlcmd
$sqlcmdPath = "sqlcmd"

# Check if sqlcmd is available
try {
    $null = Get-Command sqlcmd -ErrorAction Stop
} catch {
    Write-Host "❌ sqlcmd not found. Please install SQL Server Command Line Utilities." -ForegroundColor Red
    Write-Host "   Or run the SQL script manually in SQL Server Management Studio." -ForegroundColor Yellow
    Write-Host "   Script location: $sqlScript" -ForegroundColor Yellow
    exit 1
}

# Build connection string
$connectionString = "-S $dbHost`,$dbPort -U $dbUsername -d $dbName"

if ($dbPassword) {
    $connectionString += " -P `"$dbPassword`""
} else {
    $connectionString += " -E"  # Use Windows authentication
}

# Execute SQL script
Write-Host "Executing: sqlcmd $connectionString -i `"$sqlScript`"" -ForegroundColor Gray

& sqlcmd $connectionString -i $sqlScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ All data deleted successfully!" -ForegroundColor Green
    Write-Host "✅ Database is now empty." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Error executing SQL script. Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "   Please check the error messages above." -ForegroundColor Yellow
    exit 1
}

