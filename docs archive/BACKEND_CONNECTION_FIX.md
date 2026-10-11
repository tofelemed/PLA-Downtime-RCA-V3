# 🔧 Backend Connection Error Fix

## Error
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
Login failed TypeError: Failed to fetch
```

## Problem
The backend server is **not running**, so the frontend cannot connect to it.

## Solution

### Step 1: Start Backend Server

Open a terminal and run:
```bash
cd server/pro-act-backend
npm run start:dev
```

**Or set port explicitly:**
```bash
cd server/pro-act-backend
$env:PORT="4004"
npm run start:dev
```

### Step 2: Verify Backend is Running

Wait for this message:
```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
```

**Or check manually:**
```powershell
.\test-ui-integration.ps1
```

### Step 3: Verify Frontend Configuration

Check that frontend is pointing to the correct port:
- Frontend `httpClient.ts` defaults to: `http://localhost:4004/api`
- Make sure `.env` file has: `VITE_API_BASE_URL=http://localhost:4004/api`

### Step 4: Check Port Configuration

**Backend Port:**
- Default: Port 3000
- Current setting: Check `server/pro-act-backend/.env` for `PORT=4004`
- Or check `server/pro-act-backend/src/main.ts` line ~50

**Frontend Port:**
- Always: Port 8070
- API URL: `http://localhost:4004/api` (or 3000 if backend uses that)

---

## Quick Fix

If backend should run on port 4004:

1. **Start backend:**
   ```bash
   cd server/pro-act-backend
   npm run start:dev
   ```

2. **Verify it's running:**
   ```powershell
   try {
       Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
       Write-Host "✅ Backend is running!"
   } catch {
       Write-Host "❌ Backend not running"
   }
   ```

3. **If still not working, check port:**
   - Check backend `.env` for `PORT=`
   - Check backend terminal output for "Application is running on:"
   - Update frontend `.env` to match

---

## Port Mismatch?

If backend is running on **port 3000** but frontend expects **port 4004**:

**Option 1: Update Frontend** (Recommended)
```bash
# Create/update .env in project root
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env

# Restart frontend dev server
```

**Option 2: Change Backend Port**
```bash
# In server/pro-act-backend/.env
PORT=4004

# Restart backend
```

---

## After Backend Starts

1. **Wait 30-60 seconds** for backend to fully start
2. **Refresh browser** at http://localhost:8070
3. **Try login again**
4. **Check Network tab** - should see requests to backend

---

**Status:** Backend server is being started. Wait for it to fully start, then try login again.

