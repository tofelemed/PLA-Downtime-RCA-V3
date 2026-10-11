# 🔧 Current Issues and Fixes Applied

## ✅ Fixed Issues

### 1. `httpClient.get is not a function` Error

**Error:**
```
TypeError: httpClient.get is not a function
at Object.listSyncJobs (piIntegrationApi.ts:240:39)
```

**Fix Applied:**
Added convenience methods (`get`, `post`, `put`, `patch`, `delete`) to the `HttpClient` class in `src/services/api/httpClient.ts`. These methods wrap the `request()` method and return responses in the format expected by the API files (`{ data: TResponse }`).

**Status:** ✅ **FIXED**

---

## ⚠️ Remaining Issues

### 1. Connection Refused Errors (`net::ERR_CONNECTION_REFUSED`)

**Error:**
```
GET http://localhost:4004/api/oee-codes net::ERR_CONNECTION_REFUSED
GET http://localhost:4004/api/products net::ERR_CONNECTION_REFUSED
```

**Possible Causes:**
- Backend server stopped or crashed
- Backend is running on a different port
- Network/firewall blocking connections

**Solution:**
1. Verify backend is running:
   ```powershell
   try {
       Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
       Write-Host "✅ Backend is running"
   } catch {
       Write-Host "❌ Backend is NOT running"
   }
   ```

2. If not running, start backend:
   ```powershell
   cd server\pro-act-backend
   $env:PORT = "4004"
   npm run start:dev
   ```

**Status:** ⚠️ **NEEDS VERIFICATION**

---

### 2. JWT Authentication Errors (`401 Unauthorized`)

**Error:**
```
GET http://localhost:4004/api/impact-codes 401 (Unauthorized)
GET http://localhost:4004/api/units 401 (Unauthorized)
GET http://localhost:4004/api/assets 401 (Unauthorized)
```

**Possible Causes:**
1. **Token not being sent**: Token provider not working correctly
2. **Token expired**: Token needs refresh
3. **Token format wrong**: Token not in correct format
4. **Backend JWT_SECRET mismatch**: Backend using different secret than frontend expects

**Fixes Already Applied:**
- ✅ Tokens now load synchronously from localStorage before components mount
- ✅ Token provider updated whenever tokens change
- ✅ Token applied immediately during login

**Next Steps to Debug:**

1. **Clear browser cache and localStorage:**
   - F12 → Application → Local Storage → Clear All
   - Hard refresh (Ctrl+Shift+R)

2. **Check Network Tab:**
   - F12 → Network → Find a failing request
   - Check Request Headers:
     - **If Authorization header is MISSING:** Token provider issue
     - **If Authorization header is PRESENT:** Token validation issue

3. **Verify Token in Console:**
   ```javascript
   const authState = JSON.parse(localStorage.getItem('proact_auth_state'));
   console.log('Token exists:', !!authState?.tokens?.accessToken);
   console.log('Token preview:', authState?.tokens?.accessToken?.substring(0, 20) + '...');
   ```

4. **Check Backend JWT_SECRET:**
   - Ensure `server/pro-act-backend/.env` has `JWT_SECRET` set
   - Restart backend after changing JWT_SECRET

**Status:** ⚠️ **INVESTIGATING**

---

## 📋 Testing Checklist

- [ ] Backend server is running on port 4004
- [ ] Browser cache and localStorage cleared
- [ ] Hard refresh performed (Ctrl+Shift+R)
- [ ] Login successful
- [ ] Check Network tab for Authorization headers
- [ ] Verify no 401 errors on authenticated requests

---

**Last Updated:** After fixing `httpClient.get()` error

