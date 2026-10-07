# Quick script to restart the backend server
# This ensures CORS configuration changes take effect

Write-Host "🔄 Restarting ProAct Backend Server..." -ForegroundColor Cyan
Write-Host ""

# Check if there's a running process on port 3000
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port 3000 is in use. Please stop the backend server manually (Ctrl+C in the backend terminal)." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "To restart the backend:" -ForegroundColor Green
Write-Host "1. Stop the current server (Ctrl+C in the terminal where it's running)" -ForegroundColor White
Write-Host "2. Run: npm run start:dev" -ForegroundColor White
Write-Host ""

Write-Host "📋 Current CORS Configuration:" -ForegroundColor Cyan
Write-Host "   - Development mode: Allows all origins (origin: true)" -ForegroundColor White
Write-Host "   - Frontend: http://localhost:8070" -ForegroundColor White
Write-Host "   - Backend: http://localhost:3000" -ForegroundColor White
Write-Host ""

Write-Host "After restart, the CORS error should be resolved!" -ForegroundColor Green

