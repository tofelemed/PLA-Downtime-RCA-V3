# 🔧 Fix Connection Error - Backend Not Running

## ❌ Current Error
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
Login failed TypeError: Failed to fetch
```

**Root Cause:** Backend server is **NOT running**

---

## 🚀 Solution: Start Backend Server

### Option 1: Start Backend on Port 4004 (Matches Frontend)

**Step 1: Start Backend**
Open a new terminal and run:
```bash
cd server/pro-act-backend
$env:PORT="4004"
npm run start:dev
```

**Step 2: Wait for startup**
Look for:
```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
```

**Step 3: Test login again**
- Refresh browser at http://localhost:8070
- Try login
- Should work now! ✅

---

### Option 2: Update Frontend to Use Port 3000 (Backend Default)

**Step 1: Update Frontend .env**
Create/update `.env` in project root:
```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

**Step 2: Start Backend on Default Port**
```bash
cd server/pro-act-backend
npm run start:dev
```

**Step 3: Restart Frontend**
- Stop frontend (Ctrl+C)
- Restart: `npm run dev`

**Step 4: Test login again**

---

## 📋 Quick Check

**Backend Status:**
```powershell
.\test-ui-integration.ps1
```

**Or manually:**
```powershell
# Check port 4004
try {
    Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
    Write-Host "✅ Backend running on 4004"
} catch {
    Write-Host "❌ Backend NOT on 4004"
    
    # Check port 3000
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/api" -TimeoutSec 2
        Write-Host "✅ Backend running on 3000"
        Write-Host "⚠️ Update frontend .env to use port 3000"
    } catch {
        Write-Host "❌ Backend NOT running at all!"
        Write-Host "👉 Start backend server now!"
    }
}
```

---

## 🎯 Recommended Approach

**Use Port 4004** (matches frontend default):

1. **Set backend port to 4004:**
   ```bash
   cd server/pro-act-backend
   
   # Add to .env file (or create it)
   echo "PORT=4004" >> .env
   ```

2. **Start backend:**
   ```bash
   npm run start:dev
   ```

3. **Verify:**
   - Wait for: "Application is running on: http://localhost:4004"
   - Test: `.\test-ui-integration.ps1`

4. **Try login again** - should work! ✅

---

## ✅ After Backend Starts

Once backend is running:
- ✅ No more connection errors
- ✅ Login will work
- ✅ API calls will succeed
- ✅ Network tab will show successful requests

---

## 📝 Current Configuration

- **Frontend expects:** `http://localhost:4004/api`
- **Backend default:** Port 3000
- **Solution:** Start backend on port 4004 OR update frontend to port 3000

---

**ACTION:** Start the backend server now using one of the options above!

