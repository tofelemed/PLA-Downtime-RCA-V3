# 🔧 Fixing Persistent JWT_SECRET Mismatch

## Problem

Even after clearing localStorage and logging in again, you're still getting 401 errors. This means the token being signed during login is using a different JWT_SECRET than what's used for verification.

## Critical Check: Verify JWT_SECRET is Consistent

Both **signing** and **verification** must use the **EXACT same** JWT_SECRET:

### 1. Check `.env` File

**Location:** `server/pro-act-backend/.env`

```bash
JWT_SECRET=admin123
```

**Important:**
- ❌ NO spaces around `=`
- ❌ NO quotes around value
- ✅ Just: `JWT_SECRET=admin123`

### 2. Where JWT_SECRET is Used

**For Signing (auth.module.ts):**
```typescript
JwtModule.register({
  secret: process.env.JWT_SECRET || 'changeme',
})
```

**For Verification (jwt.strategy.ts):**
```typescript
secretOrKey: process.env.JWT_SECRET || 'changeme',
```

Both should read the same value from `process.env.JWT_SECRET`.

---

## Diagnostic Steps

### Step 1: Restart Backend (CRITICAL!)

After changing `.env`, you **MUST** restart the backend:

1. **Stop backend** (Ctrl+C in backend terminal)
2. **Wait 2 seconds**
3. **Start backend again**

The backend reads `.env` only on startup!

### Step 2: Check Backend Startup Logs

After restarting, look for:

```
[JwtStrategy] JWT Strategy initialized with secret: SET (length: 8)
```

**This confirms:**
- ✅ JWT_SECRET is being read (length 8 = "admin123")
- ✅ JwtStrategy is initialized with the secret

### Step 3: Login and Check Signing Logs

After login, you should see:

```
[AuthService] Signing token with JWT_SECRET length: 8
[AuthService] Token signed successfully for user: ...
```

**If you see different lengths, that's the problem!**

### Step 4: Check Verification Error Logs

If verification fails, you'll now see:

```
[JwtAuthGuard] JWT Verification Failed - Invalid Token: invalid signature
⚠️  Token signature mismatch - JWT_SECRET does not match!
⚠️  Current JWT_SECRET length: 8
```

---

## Common Issues

### Issue 1: .env Not Being Read

**Symptom:** Backend logs show "USING DEFAULT (changeme)" instead of "SET (length: 8)"

**Fix:**
1. Check `.env` file is in `server/pro-act-backend/.env`
2. Check file format: `JWT_SECRET=admin123` (no spaces, no quotes)
3. Restart backend

### Issue 2: Multiple .env Files

**Symptom:** Changes to `.env` don't seem to take effect

**Fix:**
- Make sure you're editing `server/pro-act-backend/.env`
- NOT a `.env` file in the root directory
- Restart backend after changes

### Issue 3: Environment Variable Cached

**Symptom:** Backend keeps using old JWT_SECRET

**Fix:**
1. Completely stop backend (Ctrl+C twice if needed)
2. Wait 5 seconds
3. Start backend again
4. Check startup logs confirm new JWT_SECRET

### Issue 4: Token Signed Before Backend Restart

**Symptom:** Even fresh tokens don't work

**Fix:**
1. **Stop backend**
2. **Clear localStorage** in browser
3. **Start backend**
4. **Login again** (get fresh token)

---

## Complete Fix Procedure

Follow these steps **in order**:

### 1. Stop Backend
```powershell
# In backend terminal, press Ctrl+C
```

### 2. Verify .env File
```bash
# Check server/pro-act-backend/.env contains:
JWT_SECRET=admin123
```

### 3. Start Backend
```powershell
cd server/pro-act-backend
$env:PORT = "4004"
npm run start:dev
```

### 4. Verify Startup Logs
Look for:
```
[JwtStrategy] JWT Strategy initialized with secret: SET (length: 8)
✅ Application is running on: http://localhost:4004
```

### 5. Clear Browser Storage
```javascript
// In browser console (F12):
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 6. Login Again
- Go to login page
- Enter credentials
- Click "Login"

### 7. Check Backend Logs After Login
You should see:
```
[AuthService] Signing token with JWT_SECRET length: 8
[AuthService] Token signed successfully for user: ...
```

### 8. Check API Requests
In browser Network tab, API requests should return `200 OK` (not `401`)

---

## Enhanced Logging Added

I've added detailed logging that will show:

1. **On Backend Startup:**
   - JWT_SECRET status (SET/USING DEFAULT)
   - JWT_SECRET length

2. **On Login:**
   - JWT_SECRET length used for signing
   - Token signing success confirmation

3. **On Verification Failure:**
   - Detailed error message
   - Signature mismatch warnings
   - Current JWT_SECRET length

**Check your backend logs to see exactly what's happening!**

---

## Quick Test

After restarting backend, check startup logs:

```
[JwtStrategy] JWT Strategy initialized with secret: SET (length: 8)
```

**If you see "USING DEFAULT" or different length, the .env file isn't being read correctly!**

---

**Next Steps:**
1. Restart backend
2. Clear localStorage
3. Login again
4. Check backend logs for detailed error messages

**The enhanced logging will show you exactly what's wrong!** 🔍
