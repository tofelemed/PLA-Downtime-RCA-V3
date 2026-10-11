# 🚀 Quick Start: Backend Then Frontend

## Simple Commands

### Step 1: Start Backend (Run in Terminal 1)

```powershell
cd "C:\apm\nw-pro-act\nw-pro-act\pro-act_19-11-2025-backendIntegrated_bck\pro-act_05-05-2025_12-47PM-working\pro-act_21-07-2025_10-36PM\pro-act\server\pro-act-backend"
$env:PORT = "4004"
npm run start:dev
```

**Wait for:**
```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
```

### Step 2: Start Frontend (Run in Terminal 2)

**Open a NEW terminal** and run:

```powershell
cd "C:\apm\nw-pro-act\nw-pro-act\pro-act_19-11-2025-backendIntegrated_bck\pro-act_05-05-2025_12-47PM-working\pro-act_21-07-2025_10-36PM\pro-act"
npm run dev
```

**Wait for:**
```
➜  Local:   http://localhost:8070/
```

### Step 3: Test

1. Open browser: http://localhost:8070
2. Try login
3. Should work! ✅

---

## Or Use the Automated Script

Run from project root:
```powershell
.\START_SERVERS.ps1
```

This will:
1. Start backend in a new window
2. Wait for it to be ready
3. Start frontend in a new window

---

## ✅ Verification

**Check backend:**
```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
    Write-Host "✅ Backend is running!"
} catch {
    Write-Host "❌ Backend not running"
}
```

**Check frontend:**
```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:8070" -TimeoutSec 2
    Write-Host "✅ Frontend is running!"
} catch {
    Write-Host "❌ Frontend not running"
}
```

---

**Ready! Both servers should now be starting!** 🚀

