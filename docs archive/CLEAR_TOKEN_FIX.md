# 🔧 Quick Fix: Clear Old JWT Tokens

## Problem

Token is being sent but verification fails. This happens when the token in localStorage was signed with a **different JWT_SECRET** than what the backend is currently using.

## Root Cause

- Old token stored in localStorage from a previous login
- Backend restarted or JWT_SECRET changed
- Token signature doesn't match current backend secret

## Solution: Clear Old Tokens

### Method 1: Browser Console (Fastest)

Open browser console (F12) and run:

```javascript
localStorage.removeItem('proact_auth_state');
console.log('✅ Cleared old authentication tokens');
console.log('Please refresh the page (F5) and login again');
```

Then refresh the page (F5) and login again.

### Method 2: DevTools Application Tab

1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Local Storage** → `http://localhost:8070`
4. Find `proact_auth_state` key
5. Right-click → **Delete**
6. Refresh page (F5)
7. Login again

### Method 3: Clear All Storage

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** button (top)
4. Click **Clear site data**
5. Refresh page (Ctrl+Shift+R)
6. Login again

---

## After Clearing

1. ✅ Clear localStorage
2. ✅ Refresh page (F5 or Ctrl+Shift+R)
3. ✅ Login with credentials
4. ✅ New token will be signed with current JWT_SECRET
5. ✅ All API requests should work!

---

**Try this now - it should fix the 401 errors!** 🔄

