# PowerShell script to fix pi_sync_jobs.id DEFAULT constraint
# This script adds DEFAULT NEWID() to the id column to prevent NULL insertion errors

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
Write-Host "Fix pi_sync_jobs.id DEFAULT Constraint" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Determine database connection parameters
$dbServer = $ServerName
$dbName = $DatabaseName
$dbUser = $Username
$dbPassword = $Password

# Fallback to environment variables if parameters are not provided
if ([string]::IsNullOrEmpty($dbServer)) { 
    $dbServer = $env:DB_HOST
    if ([string]::IsNullOrEmpty($dbServer)) { $dbServer = "localhost" }
}
if ([string]::IsNullOrEmpty($dbName)) { 
    $dbName = $env:DB_NAME
    if ([string]::IsNullOrEmpty($dbName)) { $dbName = "ProActDB" }
}
if ([string]::IsNullOrEmpty($dbUser)) { 
    $dbUser = $env:DB_USERNAME
    if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "sa" }
}
if ([string]::IsNullOrEmpty($dbPassword)) { 
    $dbPassword = $env:DB_PASSWORD
    if ([string]::IsNullOrEmpty($dbPassword)) { $dbPassword = "" }
}

$scriptFile = "fix-pi-sync-jobs-id-default.sql"
$scriptPath = Join-Path $PSScriptRoot $scriptFile

if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Error: Script not found at: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Script: $scriptFile" -ForegroundColor Yellow
Write-Host "🗄️  Database: $dbName on $dbServer" -ForegroundColor Yellow
Write-Host ""

# Check if sqlcmd is available
$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue

if (-not $sqlcmdPath) {
    Write-Host "⚠️  Warning: sqlcmd not found in PATH" -ForegroundColor Yellow
    Write-Host "   Please install SQL Server Command Line Utilities or run the script manually" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual execution:" -ForegroundColor Cyan
    if ($UseWindowsAuth) {
        Write-Host "   sqlcmd -S $dbServer -d $dbName -E -i `"$scriptPath`"" -ForegroundColor White
    } else {
        Write-Host "   sqlcmd -S $dbServer -d $dbName -U $dbUser -P '$dbPassword' -i `"$scriptPath`"" -ForegroundColor White
    }
    Write-Host ""
    exit 1
}

# Build sqlcmd authentication arguments
$authArgs = @()
if ($UseWindowsAuth) {
    $authArgs += "-E"
    Write-Host "Authentication: Windows Authentication" -ForegroundColor Yellow
} else {
    $authArgs += "-U", $dbUser, "-P", $dbPassword
    Write-Host "Authentication: SQL Server Authentication (User: $dbUser)" -ForegroundColor Yellow
}
Write-Host ""

# Execute SQL script
Write-Host "🚀 Running fix script..." -ForegroundColor Green
Write-Host ""

$sqlcmdArgs = @(
    "-S", $dbServer,
    "-d", $dbName,
    "-i", $scriptPath,
    "-b"
)
$sqlcmdArgs += $authArgs

try {
    & sqlcmd @sqlcmdArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Fix completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Restart the backend server" -ForegroundColor White
        Write-Host "  2. Test creating a PI sync job" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Please check the error messages above" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host 'Error executing script:' -ForegroundColor Red -NoNewline
    Write-Host " $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

