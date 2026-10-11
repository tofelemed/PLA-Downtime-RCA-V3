# 🔧 Fix: 401 Errors After Login

## Problem

After successfully logging in, all API requests immediately fail with `401 Unauthorized`. This happens because:

1. **Old tokens in localStorage** - Previous tokens signed with a different JWT_SECRET
2. **Token not immediately available** - Race condition where components make requests before token is set
3. **Token provider not working** - Token is set but httpClient can't access it

## Solution

### Step 1: Clear Old Tokens (REQUIRED)

**In Browser Console (F12):**
```javascript
localStorage.removeItem('proact_auth_state');
console.log('✅ Cleared old authentication tokens');
location.reload(); // Reload page
```

**Or manually:**
1. F12 → Application tab
2. Local Storage → `http://localhost:8070`
3. Delete `proact_auth_state`
4. Refresh page (Ctrl+Shift+R)

### Step 2: Verify Token is Being Sent

After login, check browser console for:
- `[HttpClient] Sending request to ... with token: ...` (should appear)
- `[HttpClient] ❌ No token available for authenticated request to ...` (should NOT appear)

### Step 3: Check Network Tab

1. F12 → Network tab
2. Filter by "XHR"
3. After login, check requests like `/api/organizations`
4. Click on request → Headers tab
5. Look for `Authorization: Bearer eyJ...` header

**If Authorization header is MISSING:**
- Token provider is not working
- Token is not being set correctly

**If Authorization header is PRESENT:**
- Token is being sent
- Problem is on backend (JWT_SECRET mismatch or token validation)

### Step 4: Verify Backend JWT_SECRET

Check backend terminal for:
```
[JwtStrategy] JWT Strategy initialized with secret: SET (length: XX)
```

If you see:
- `USING DEFAULT (changeme)` → JWT_SECRET not loaded from .env
- `SET (length: XX)` → JWT_SECRET is loaded correctly

### Step 5: Clear and Re-Login

1. **Clear localStorage** (Step 1)
2. **Refresh page** (Ctrl+Shift+R)
3. **Login again** with credentials
4. **Check console** for debug messages
5. **Check Network tab** for Authorization headers

---

## Quick Fix Script

Run this in browser console BEFORE logging in:

```javascript
// Clear old tokens
localStorage.removeItem('proact_auth_state');
console.log('✅ Cleared old tokens - ready to login!');
// Then refresh and login
location.reload();
```

---

## Expected Behavior After Fix

1. ✅ Login succeeds
2. ✅ No 401 errors in console
3. ✅ API requests include `Authorization: Bearer ...` header
4. ✅ Dashboard loads successfully
5. ✅ Plant hierarchy loads

---

**This should fix all 401 errors!** 🔄

