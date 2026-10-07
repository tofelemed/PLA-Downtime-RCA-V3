@echo off
REM Connectivity Module Testing Setup Script for Windows
REM This script helps set up the environment for testing the Connectivity module

echo 🚀 Setting up Connectivity Module Testing Environment
echo ==================================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the server/pro-act-backend directory
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are available

REM Install dependencies if needed
echo 📦 Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
) else (
    echo ✅ Dependencies already installed
)

REM Check if bcrypt is installed
npm list bcrypt >nul 2>&1
if errorlevel 1 (
    echo Installing bcrypt...
    npm install bcrypt @types/bcrypt
)

echo ✅ Dependencies are ready

REM Check if database migration file exists
if exist "connectivity-migration.sql" (
    echo ✅ Database migration file found
    echo 📋 To set up the database, run the SQL commands in connectivity-migration.sql
) else (
    echo ⚠️  Database migration file not found
)

REM Check if the backend is running
echo 🔍 Checking if backend server is running...
curl -s http://localhost:3000/api/connectivity/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend server is not running or not accessible
    echo    Please start the backend server with: npm run start:dev
) else (
    echo ✅ Backend server is running and accessible
)

echo.
echo 🎯 Setup Complete!
echo ==================
echo.
echo Next steps:
echo 1. Set up your database and run the migration: connectivity-migration.sql
echo 2. Start the backend server: npm run start:dev
echo 3. Run the test script: node test-connectivity.js
echo 4. Or import the Postman collection: Connectivity_Module_Tests.postman_collection.json
echo.
echo 📚 For detailed testing instructions, see: CONNECTIVITY_TESTING_GUIDE.md
echo.
pause
