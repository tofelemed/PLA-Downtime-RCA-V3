# =============================================
# Run Hierarchy Mapping Migration Script
# PowerShell script to execute the migration
# =============================================

param(
    [string]$ServerInstance = "localhost",
    [string]$Database = "ProActDB",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$UseWindowsAuth = $true
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Hierarchy Mapping Migration Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$ScriptPath = Join-Path $PSScriptRoot "create-source-hierarchy-mappings-table.sql"

if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERROR: Migration script not found at: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found migration script: $ScriptPath" -ForegroundColor Green
Write-Host ""

# Build connection string
if ($UseWindowsAuth) {
    Write-Host "Using Windows Authentication" -ForegroundColor Yellow
} else {
    if ([string]::IsNullOrEmpty($Username) -or [string]::IsNullOrEmpty($Password)) {
        Write-Host "ERROR: Username and Password required when not using Windows Authentication" -ForegroundColor Red
        exit 1
    }
    Write-Host "Using SQL Server Authentication" -ForegroundColor Yellow
}

Write-Host "Server: $ServerInstance" -ForegroundColor White
Write-Host "Database: $Database" -ForegroundColor White
Write-Host ""

# Test connection
Write-Host "Testing database connection..." -ForegroundColor Yellow
try {
    $testConnection = New-Object System.Data.SqlClient.SqlConnection
    if ($UseWindowsAuth) {
        $testConnection.ConnectionString = "Server=$ServerInstance;Database=$Database;Integrated Security=true;Connection Timeout=30"
    } else {
        $testConnection.ConnectionString = "Server=$ServerInstance;Database=$Database;User Id=$Username;Password=$Password;Connection Timeout=30"
    }
    $testConnection.Open()
    $testConnection.Close()
    Write-Host "✓ Connection successful!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to connect to database" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Run migration
Write-Host "Executing migration script..." -ForegroundColor Yellow
Write-Host ""

$LogPath = Join-Path $PSScriptRoot "hierarchy-mapping-migration-log.txt"

try {
    if ($UseWindowsAuth) {
        $result = sqlcmd -S $ServerInstance -d $Database -E -i $ScriptPath -o $LogPath -W
    } else {
        $result = sqlcmd -S $ServerInstance -d $Database -U $Username -P $Password -i $ScriptPath -o $LogPath -W
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "SQL script execution failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Show log output
    if (Test-Path $LogPath) {
        Write-Host "Migration Log:" -ForegroundColor Yellow
        Get-Content $LogPath | Write-Host
        Write-Host ""
    }
    
    # Verify table creation
    Write-Host "Verifying table creation..." -ForegroundColor Yellow
    $verifyQuery = "SELECT CASE WHEN EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'source_hierarchy_mappings') AND type in (N'U')) THEN 'EXISTS' ELSE 'NOT_FOUND' END AS Status"
    
    if ($UseWindowsAuth) {
        $verifyResult = sqlcmd -S $ServerInstance -d $Database -E -Q $verifyQuery -h-1 -W
    } else {
        $verifyResult = sqlcmd -S $ServerInstance -d $Database -U $Username -P $Password -Q $verifyQuery -h-1 -W
    }
    
    if ($verifyResult -match "EXISTS") {
        Write-Host "✓ Table 'source_hierarchy_mappings' created successfully!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠ Warning: Could not verify table creation. Please check manually." -ForegroundColor Yellow
        Write-Host ""
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Migration failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    if (Test-Path $LogPath) {
        Write-Host "Log file contents:" -ForegroundColor Yellow
        Get-Content $LogPath | Write-Host
    }
    exit 1
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "✓ MIGRATION COMPLETE!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart your backend server" -ForegroundColor White
Write-Host "2. Test the API endpoints via Swagger UI" -ForegroundColor White
Write-Host "3. Create mappings using the frontend" -ForegroundColor White
Write-Host ""
