# =============================================
# PowerShell Script: Run Organization Fields Migration
# =============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Organization Fields Migration Script Runner" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationScript = Join-Path $scriptDir "add-organization-fields-migration.sql"

# Check if migration script exists
if (-not (Test-Path $migrationScript)) {
    Write-Host "ERROR: Migration script not found at:" -ForegroundColor Red
    Write-Host "  $migrationScript" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: Migration script found" -ForegroundColor Green
Write-Host ""

# Database connection parameters (update these if needed)
$dbServer = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "1433" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "ProActDB" }
$dbUser = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "sa" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }

# Check if sqlcmd is available
$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue

if (-not $sqlcmdPath) {
    Write-Host "ERROR: sqlcmd not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please use one of these methods instead:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Method 1: SQL Server Management Studio (SSMS)" -ForegroundColor White
    Write-Host "  1. Open SSMS and connect to your SQL Server" -ForegroundColor Gray
    Write-Host "  2. Open file: $migrationScript" -ForegroundColor Gray
    Write-Host "  3. Execute the script" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Method 2: Azure Data Studio" -ForegroundColor White
    Write-Host "  1. Open Azure Data Studio" -ForegroundColor Gray
    Write-Host "  2. Connect to your database" -ForegroundColor Gray
    Write-Host "  3. Open and run the script" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "OK: sqlcmd found" -ForegroundColor Green
Write-Host ""

# Build connection string
$serverInstance = if ($dbPort -eq "1433") { $dbServer } else { "$dbServer,$dbPort" }

Write-Host "Database Connection:" -ForegroundColor Yellow
Write-Host "  Server: $serverInstance" -ForegroundColor White
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host ""

# Confirm before running
$confirm = Read-Host "Do you want to run the migration? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Running migration..." -ForegroundColor Cyan
Write-Host ""

# Run the migration
try {
    if ($dbPassword) {
        # With password
        $env:MSSQL_PASSWORD = $dbPassword
        sqlcmd -S $serverInstance -d $dbName -U $dbUser -P $dbPassword -i $migrationScript -W
        $env:MSSQL_PASSWORD = $null
    } else {
        # Windows Authentication (trusted connection)
        sqlcmd -S $serverInstance -d $dbName -E -i $migrationScript -W
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "SUCCESS: Migration completed successfully!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Restart the backend server" -ForegroundColor White
        Write-Host "  2. Test organization creation in the frontend" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Error running migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
