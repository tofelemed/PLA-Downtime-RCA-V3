# Start Backend Server on Port 4004
# PowerShell script - no cross-env needed

Write-Host "Starting Backend Server on port 4004..." -ForegroundColor Cyan

$env:PORT = "4004"
cd server/pro-act-backend

Write-Host "Current directory: $PWD" -ForegroundColor Gray
Write-Host "PORT environment variable: $env:PORT" -ForegroundColor Gray

npm run start:dev

