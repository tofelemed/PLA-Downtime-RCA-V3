# 🚀 Quick Fix: 401 Errors After Login

## The Problem

After logging in successfully, you're getting `401 Unauthorized` errors on all API requests. This is because there's an **old token in localStorage** from a previous session that conflicts with the new token.

## Immediate Fix (2 Steps)

### Step 1: Clear Old Tokens

**Open Browser Console (F12)** and run:

```javascript
localStorage.removeItem('proact_auth_state');
console.log('✅ Cleared old tokens');
```

### Step 2: Refresh and Login

1. **Refresh the page** (Ctrl+Shift+R or F5)
2. **Login again** with your credentials
3. **Check console** - you should see:
   - `[AuthContext] ✅ Token set successfully`
   - `[AuthContext] ✅ Login completed successfully`

## Verify It's Fixed

After logging in, check the **Network tab** (F12 → Network):

1. Look for requests like `/api/organizations`, `/api/tenants`
2. Click on one of them
3. Go to **Headers** tab
4. Scroll to **Request Headers**
5. You should see: `Authorization: Bearer eyJ...` ✅

If you see the Authorization header, the token is being sent correctly!

---

## If Still Not Working

1. **Check backend console** - Look for JWT logs:
   - `[JwtStrategy] JWT Strategy initialized with secret: SET`
   - `[JwtAuthGuard] Authorization header present: Bearer...`

2. **Check browser console** for:
   - `[HttpClient] ❌ No token available...` (should NOT appear)
   - `[AuthContext] ✅ Token set successfully` (should appear)

3. **Verify JWT_SECRET match**:
   - Backend `.env` has `JWT_SECRET=...`
   - Token was signed with same secret as backend uses to verify

---

**Run the fix above and try logging in again!** 🔄

