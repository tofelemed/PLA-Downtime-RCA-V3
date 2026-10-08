# =============================================
# ProAct Database Automated Setup Script
# PowerShell version for Windows
# =============================================

Write-Host ""
Write-Host "=============================================="
Write-Host "ProAct Database Automated Setup"
Write-Host "=============================================="
Write-Host ""

# Configuration
$ServerInstance = "localhost"
$Database = "ProActDB"
$ScriptPath = "complete-automated-setup.sql"
$LogPath = "setup-log.txt"

# Function to test SQL Server connection
function Test-SQLConnection {
    param($ServerInstance)
    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection
        $connection.ConnectionString = "Server=$ServerInstance;Integrated Security=true;Connection Timeout=3"
        $connection.Open()
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Step 1: Check SQL Server
Write-Host "Step 1: Checking SQL Server..." -ForegroundColor Yellow

$service = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue

if ($null -eq $service) {
    Write-Host "  ERROR: SQL Server service not found!" -ForegroundColor Red
    Write-Host "  Please install SQL Server first" -ForegroundColor Red
    exit 1
}

if ($service.Status -ne "Running") {
    Write-Host "  SQL Server is not running. Starting..." -ForegroundColor Yellow
    Start-Service -Name "MSSQLSERVER"
    Start-Sleep -Seconds 5
}

if (Test-SQLConnection -ServerInstance $ServerInstance) {
    Write-Host "  OK SQL Server is running and accessible" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Cannot connect to SQL Server!" -ForegroundColor Red
    Write-Host "  Please check SQL Server configuration" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Running database setup script..." -ForegroundColor Yellow
Write-Host "  Creating database and all 50 tables..." -ForegroundColor Cyan
Write-Host ""

# Run the SQL script
try {
    sqlcmd -S $ServerInstance -E -i $ScriptPath -o $LogPath
    
    if ($LASTEXITCODE -ne 0) {
        throw "SQL script execution failed"
    }
    
    Write-Host "  OK Database setup completed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: Database setup failed!" -ForegroundColor Red
    Write-Host "  Check $LogPath for details" -ForegroundColor Red
    Write-Host ""
    Get-Content $LogPath
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying setup..." -ForegroundColor Yellow

# Verify database
try {
    $tableCount = sqlcmd -S $ServerInstance -E -d $Database -Q "SELECT COUNT(*) FROM sys.tables" -h-1 -W
    $tableCount = $tableCount.Trim()
    
    Write-Host "  OK Database ProActDB verified" -ForegroundColor Green
    Write-Host "  OK Tables created: $tableCount" -ForegroundColor Green
    
    if ([int]$tableCount -ge 50) {
        Write-Host "  OK All tables created successfully!" -ForegroundColor Green
    } else {
        Write-Host "  Warning: Expected 50+ tables, found $tableCount" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR: Verification failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=============================================="  -ForegroundColor Cyan
Write-Host "SUCCESS - DATABASE SETUP COMPLETE!" -ForegroundColor Green
Write-Host "=============================================="  -ForegroundColor Cyan
Write-Host ""
Write-Host "Database: ProActDB" -ForegroundColor White
Write-Host "Tables: $tableCount" -ForegroundColor White
Write-Host "Status: READY" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure .env file:" -ForegroundColor White
Write-Host "   DB_HOST=localhost"
Write-Host "   DB_PORT=1433"
Write-Host "   DB_USERNAME=sa"
Write-Host "   DB_PASSWORD=YourPassword"
Write-Host "   DB_NAME=ProActDB"
Write-Host ""
Write-Host "2. Configure JWT secrets:" -ForegroundColor White
Write-Host "   JWT_SECRET=your-secret-key-min-32-chars"
Write-Host "   JWT_REFRESH_SECRET=your-refresh-secret"
Write-Host ""
Write-Host "3. Install and start backend:" -ForegroundColor White
Write-Host "   npm install"
Write-Host "   npm run start:dev"
Write-Host ""
Write-Host "4. Access Swagger UI:" -ForegroundColor White
Write-Host "   http://localhost:3000/api"
Write-Host ""
Write-Host "=============================================="  -ForegroundColor Cyan
Write-Host ""

# Show log file content
Write-Host "Setup Log:" -ForegroundColor Yellow
Get-Content $LogPath

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
