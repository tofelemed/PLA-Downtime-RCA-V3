# 🔧 Fix JWT_SECRET Mismatch Issue

## Problem Identified

The logs show:
- ✅ Token IS being sent: `Authorization header present: Bearer eyJhbGciOiJIU...`
- ❌ Token verification FAILS: Error at `jsonwebtoken.verify`

This indicates a **JWT_SECRET mismatch** - the token was signed with one secret, but the backend is trying to verify it with a different secret.

## Root Cause

**Tokens stored in localStorage were signed with an OLD JWT_SECRET**, but the backend is now using a different secret (or default 'changeme').

## Solution

### Step 1: Clear Old Tokens

**In Browser:**
1. Open DevTools (F12)
2. Go to **Application** tab
3. **Local Storage** → `http://localhost:8070`
4. **Delete** the `proact_auth_state` key
5. **Hard refresh** (Ctrl+Shift+R)

### Step 2: Verify JWT_SECRET in Backend

**Check backend `.env` file:**
```bash
# Location: server/pro-act-backend/.env
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-change-this-in-production-abc123
```

**Verify it's set:**
- Should be minimum 32 characters
- Should NOT be 'changeme' (default)
- Should match what's used in `auth.module.ts`

### Step 3: Check Backend Startup Logs

Look for this in backend console:
```
[JwtStrategy] JWT Strategy initialized with secret: SET (length: XX)
```

If you see:
- `USING DEFAULT (changeme)` → JWT_SECRET not loaded from .env
- `SET (length: XX)` → JWT_SECRET is loaded

### Step 4: Restart Backend

If JWT_SECRET was changed or missing:
1. Stop backend (Ctrl+C)
2. Restart backend
3. Verify log shows: `JWT Strategy initialized with secret: SET`

### Step 5: Login Again

After clearing localStorage and restarting backend:
1. Login with credentials
2. New token will be signed with current JWT_SECRET
3. Verification should now work!

---

## Quick Fix Script

Run this in browser console to clear old tokens:

```javascript
localStorage.removeItem('proact_auth_state');
console.log('✅ Cleared old authentication tokens');
console.log('Please refresh the page and login again');
```

Then refresh the page (F5) and login.

---

**This should fix the 401 errors!** 🔄

