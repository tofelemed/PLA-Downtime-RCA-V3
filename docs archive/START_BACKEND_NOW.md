# 🚀 START BACKEND SERVER NOW

## ⚠️ Current Error
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
Login failed TypeError: Failed to fetch
```

**The backend server is NOT running!**

---

## 🔧 Quick Fix (3 Steps)

### Step 1: Start Backend Server

**Open a NEW terminal window** and run:

```bash
cd server/pro-act-backend
npm run start:dev
```

**If you want to use port 4004 (matches frontend):**
```bash
cd server/pro-act-backend
$env:PORT="4004"
npm run start:dev
```

**OR set in .env file:**
```bash
cd server/pro-act-backend
echo "PORT=4004" >> .env
npm run start:dev
```

### Step 2: Wait for Backend to Start

**Look for these messages:**
```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
✅ CORS enabled - Frontend can connect from any origin in development
```

**This takes 30-60 seconds** - be patient!

### Step 3: Test Login Again

1. **Refresh browser** at http://localhost:8070
2. **Try login again**
3. **Check Network tab** - should see successful API call!

---

## ✅ Verify Backend is Running

Run this command:
```powershell
.\test-ui-integration.ps1
```

Or manually check:
```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
    Write-Host "✅ Backend is running!"
} catch {
    Write-Host "❌ Backend is NOT running yet - wait a bit longer"
}
```

---

## 🎯 Port Configuration

**Current Setup:**
- Frontend expects: `http://localhost:4004/api`
- Backend default: Port 3000
- **Solution:** Start backend on port 4004

**To use port 4004:**
1. Set environment variable: `$env:PORT="4004"`
2. OR add to `.env` file: `PORT=4004`
3. Then start: `npm run start:dev`

---

## 📋 Complete Startup Sequence

1. **Terminal 1 - Backend:**
   ```bash
   cd server/pro-act-backend
   $env:PORT="4004"
   npm run start:dev
   ```

2. **Wait for:** "Application is running on: http://localhost:4004"

3. **Terminal 2 - Frontend (already running):**
   - Should be on: http://localhost:8070

4. **Browser:**
   - Open: http://localhost:8070
   - Try login
   - Should work! ✅

---

## ❌ Common Mistakes

1. **Starting backend on wrong port**
   - Check terminal output for actual port
   - Must match frontend expectation (4004)

2. **Not waiting for backend to start**
   - Backend takes 30-60 seconds
   - Wait for "Application is running" message

3. **Port mismatch**
   - Frontend: 4004
   - Backend: Must also be 4004 (or update frontend)

---

**ACTION REQUIRED:** Start the backend server now!

