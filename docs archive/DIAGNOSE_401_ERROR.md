# 🔍 Diagnose 401 Error - Step by Step

## Problem

After login, all API requests return `401 Unauthorized`. We need to determine if:
1. Token is NOT being sent (frontend issue)
2. Token IS being sent but invalid (backend issue)

## Step 1: Check Browser Console

After logging in, open console (F12) and look for:

### ✅ Should See:
```
[AuthContext] ✅ Token set successfully, length: XXX
[AuthContext] ✅ Login completed successfully
[HttpClient] Sending request to /api/organizations with token: eyJ...
```

### ❌ Should NOT See:
```
[HttpClient] ❌ No token available for authenticated request to ...
```

## Step 2: Check Network Tab (CRITICAL!)

1. **F12 → Network tab**
2. **Filter by "XHR"**
3. **Find a failing request** (e.g., `GET /api/organizations` - 401)
4. **Click on it**
5. **Go to "Headers" tab**
6. **Scroll to "Request Headers"**
7. **Look for `Authorization` header**

### If Authorization Header is PRESENT:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Meaning:** Token IS being sent → Problem is **backend token validation**

**Next:** Check backend logs for JWT verification errors

### If Authorization Header is MISSING:
```
(No Authorization header found)
```

**Meaning:** Token is NOT being sent → Problem is **frontend token provider**

**Next:** Fix token provider in AuthContext/httpClient

## Step 3: Check Backend Logs

Look in backend terminal for:

```
[JwtAuthGuard] Authorization header present: Bearer eyJ...
[JwtStrategy] Validating JWT payload for user: ...
[JwtAuthGuard] JWT authentication failed: ...
```

## Step 4: Verify Token in localStorage

In browser console, run:

```javascript
const authState = JSON.parse(localStorage.getItem('proact_auth_state'));
console.log('Token:', authState?.tokens?.accessToken?.substring(0, 50) + '...');
console.log('Token length:', authState?.tokens?.accessToken?.length);
```

## What to Report

Please check and report:

1. ✅/❌ Is `Authorization` header present in Network tab?
2. ✅/❌ Do you see console messages about token being set?
3. ✅/❌ What do backend logs show?
4. ✅/❌ What's the token length in localStorage?

---

**This will help us identify the exact problem!** 🔍

