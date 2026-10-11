# ⚠️ URGENT: Backend Server Not Running

## Error You're Seeing
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
Login failed TypeError: Failed to fetch
```

**This means:** The backend server is **NOT running**, so the frontend cannot connect.

---

## 🔧 Quick Fix (2 Steps)

### Step 1: Start Backend Server

**Open a NEW terminal window** and run:

```bash
cd server/pro-act-backend
npm run start:dev
```

**Wait for this message:**
```
✅ Application is running on: http://localhost:XXXX
✅ API documentation available at: http://localhost:XXXX/api
```

(XXXX will be 3000 or 4004 depending on your configuration)

### Step 2: Verify Port Configuration

**Check what port backend is using:**
- Look at the terminal output after starting
- It will show: "Application is running on: http://localhost:XXXX"

**Make sure frontend matches:**
- Frontend expects: `http://localhost:4004/api` (from httpClient.ts)
- If backend is on port 3000, update frontend `.env`:
  ```bash
  echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env
  # Then restart frontend dev server
  ```

---

## 🔍 How to Check Backend Status

Run this command:
```powershell
.\test-ui-integration.ps1
```

Or manually:
```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
    Write-Host "✅ Backend is running on port 4004"
} catch {
    Write-Host "❌ Backend is NOT running"
    
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/api" -TimeoutSec 2
        Write-Host "✅ Backend is running on port 3000"
        Write-Host "⚠️ Frontend needs to be updated to use port 3000"
    } catch {
        Write-Host "❌ Backend is NOT running on port 3000 either"
        Write-Host "👉 Please start the backend server!"
    }
}
```

---

## 📋 Complete Steps

1. **Open Terminal 1:**
   ```bash
   cd server/pro-act-backend
   npm run start:dev
   ```

2. **Wait for backend to start** (30-60 seconds)

3. **Check the port it's running on:**
   - Look for: "Application is running on: http://localhost:XXXX"

4. **Update frontend if needed:**
   - If backend is on port 3000, create/update `.env`:
     ```bash
     VITE_API_BASE_URL=http://localhost:3000/api
     ```
   - Restart frontend dev server

5. **Refresh browser** at http://localhost:8070

6. **Try login again**

---

## ✅ Once Backend is Running

After backend starts, you should see in the Network tab:
- ✅ Request to: `http://localhost:XXXX/api/auth/login`
- ✅ Response with `access_token`
- ✅ Login successful

---

**ACTION REQUIRED:** Start the backend server now!

