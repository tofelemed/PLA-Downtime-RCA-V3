@echo off
REM =============================================
REM ProAct Database Automated Setup Script
REM For Windows with SQL Server
REM =============================================

echo.
echo ==============================================
echo ProAct Database Automated Setup
echo ==============================================
echo.

REM Check if SQL Server is running
sc query MSSQLSERVER | find "RUNNING" >nul
if errorlevel 1 (
    echo ERROR: SQL Server is not running!
    echo.
    echo Starting SQL Server...
    net start MSSQLSERVER
    timeout /t 5 /nobreak >nul
)

echo Step 1: Checking SQL Server connection...
sqlcmd -S localhost -Q "SELECT @@VERSION" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Cannot connect to SQL Server!
    echo.
    echo Please check:
    echo 1. SQL Server is installed
    echo 2. SQL Server is running
    echo 3. SQL Server authentication is enabled
    echo.
    pause
    exit /b 1
)
echo   ✓ SQL Server is running

echo.
echo Step 2: Running database setup script...
echo   This will create database and all 50 tables...
echo.

sqlcmd -S localhost -E -i "database-setup\complete-automated-setup.sql" -o "database-setup\setup-log.txt"

if errorlevel 1 (
    echo.
    echo ERROR: Database setup failed!
    echo Check database-setup\setup-log.txt for details
    echo.
    type database-setup\setup-log.txt
    pause
    exit /b 1
)

echo.
echo ✓ Database setup completed successfully!
echo.
echo Step 3: Verifying setup...

REM Verify database exists
sqlcmd -S localhost -E -Q "SELECT COUNT(*) FROM ProActDB.sys.tables" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Database verification failed!
    pause
    exit /b 1
)

echo   ✓ Database ProActDB verified

REM Count tables
for /f "tokens=*" %%a in ('sqlcmd -S localhost -E -d ProActDB -Q "SELECT COUNT(*) FROM sys.tables" -h-1 -W') do set TABLE_COUNT=%%a
echo   ✓ Tables created: %TABLE_COUNT%

echo.
echo ==============================================
echo ✓✓✓ DATABASE SETUP COMPLETE! ✓✓✓
echo ==============================================
echo.
echo Database: ProActDB
echo Tables: %TABLE_COUNT%
echo Status: READY
echo.
echo Next Steps:
echo 1. Configure .env file with:
echo    DB_HOST=localhost
echo    DB_PORT=1433
echo    DB_USERNAME=sa
echo    DB_PASSWORD=YourPassword
echo    DB_NAME=ProActDB
echo.
echo 2. Configure JWT secrets:
echo    JWT_SECRET=your-secret-key
echo    JWT_REFRESH_SECRET=your-refresh-secret
echo.
echo 3. Run: npm install
echo 4. Run: npm run start:dev
echo 5. Access: http://localhost:3000/api
echo.
echo ==============================================
echo.

pause

