# =============================================
# Connectivity Module Database Migration Script
# PowerShell script to execute the migration
# =============================================

param(
    [string]$ServerName = "localhost",
    [string]$DatabaseName = "ProActDB",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$UseWindowsAuth = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Connectivity Module Database Migration" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Use parameter values or fall back to environment variables or defaults
$dbServer = if ($ServerName) { $ServerName } elseif ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbName = if ($DatabaseName) { $DatabaseName } elseif ($env:DB_NAME) { $env:DB_NAME } else { "ProActDB" }
$dbUser = if ($Username) { $Username } elseif ($env:DB_USERNAME) { $env:DB_USERNAME } else { "sa" }
$dbPassword = if ($Password) { $Password } elseif ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }

$migrationScript = "add-connectivity-missing-fields-migration.sql"
$scriptPath = Join-Path $PSScriptRoot $migrationScript

if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Error: Migration script not found at: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Migration Script: $migrationScript" -ForegroundColor Yellow
Write-Host "🗄️  Database: $dbName on $dbServer" -ForegroundColor Yellow
Write-Host ""

# Check if sqlcmd is available
$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue

if (-not $sqlcmdPath) {
    Write-Host "⚠️  Warning: sqlcmd not found in PATH" -ForegroundColor Yellow
    Write-Host "   Please install SQL Server Command Line Utilities or run the script manually" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual execution:" -ForegroundColor Cyan
    Write-Host "   sqlcmd -S $dbServer -d $dbName -U $dbUser -P '$dbPassword' -i `"$scriptPath`"" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "🚀 Running migration..." -ForegroundColor Green
Write-Host ""

# Build sqlcmd command
if ($UseWindowsAuth) {
    $sqlcmdArgs = @(
        "-S", $dbServer,
        "-d", $dbName,
        "-E",  # Use Windows Authentication
        "-i", $scriptPath,
        "-b"  # Exit on error
    )
} else {
    $sqlcmdArgs = @(
        "-S", $dbServer,
        "-d", $dbName,
        "-U", $dbUser,
        "-P", $dbPassword,
        "-i", $scriptPath,
        "-b"  # Exit on error
    )
}

try {
    & sqlcmd @sqlcmdArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Restart the backend server" -ForegroundColor White
        Write-Host "  2. Test connectivity endpoints" -ForegroundColor White
        Write-Host "  3. Verify entity mappings in application logs" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Please check the error messages above" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error executing migration: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

