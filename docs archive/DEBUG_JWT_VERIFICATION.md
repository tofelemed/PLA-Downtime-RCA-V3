# 🔍 Debugging JWT Verification Failure

## Problem

Even after clearing localStorage and logging in again, you're still getting 401 errors. The backend logs show:
- ✅ Token is being sent
- ❌ JWT verification is failing (invalid signature)

## Root Cause

The error `jsonwebtoken/verify.js:171` means the token signature is invalid. This happens when:
1. Token was signed with a different JWT_SECRET than what's used for verification
2. JWT_SECRET changed between signing and verification
3. Environment variable not being read correctly

## Diagnostic Steps

### Step 1: Check Backend Logs After Login

After you login, look in the backend terminal for:
```
[AuthService] Signing token with JWT_SECRET length: 8
[AuthService] Token signed successfully for user: ...
```

**If you see different lengths or errors, that's the problem!**

### Step 2: Verify JWT_SECRET Consistency

Both signing and verification should use the SAME JWT_SECRET:

**Signing (auth.module.ts):**
```typescript
JwtModule.register({
  secret: process.env.JWT_SECRET || 'changeme',
})
```

**Verification (jwt.strategy.ts):**
```typescript
secretOrKey: process.env.JWT_SECRET || 'changeme',
```

### Step 3: Check .env File

Make sure `server/pro-act-backend/.env` has:
```bash
JWT_SECRET=<redacted>
```

**NO spaces, NO quotes around the value!**

### Step 4: Restart Backend After .env Changes

If you changed `.env`, you MUST restart the backend:
1. Stop backend (Ctrl+C)
2. Start backend again

## Possible Issues

### Issue 1: .env File Format

**Wrong:**
```bash
JWT_SECRET = <redacted>  # Spaces around =
JWT_SECRET="<redacted>"  # Quotes (sometimes causes issues)
```

**Correct:**
```bash
JWT_SECRET=<redacted>
```

### Issue 2: Backend Not Restarted

If you changed `.env`, the backend needs to be restarted to pick up changes.

### Issue 3: Multiple .env Files

Make sure you're editing the right `.env` file:
- Should be in: `server/pro-act-backend/.env`
- NOT in root directory

---

## Enhanced Error Logging

I've added detailed logging that will show:
- What JWT_SECRET length is used when signing tokens
- Detailed JWT verification errors
- Signature mismatch warnings

**Check backend logs after login - you'll see exactly what's happening!**

---

## Quick Fix

1. **Verify .env file:**
   ```bash
   JWT_SECRET=<redacted>
   ```

2. **Restart backend** (completely stop and start)

3. **Clear localStorage** (browser console F12):
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

4. **Login again**

5. **Check backend logs** - should show:
   ```
   [AuthService] Signing token with JWT_SECRET length: 8
   [JwtStrategy] Validating JWT payload for user: ...
   [JwtStrategy] JWT validation successful
   ```

---

**Check backend logs after login to see the detailed error messages!** 🔍

