# 🔍 How to Check JWT Token in Browser

## Quick Check

### 1. Open Browser DevTools (F12)

### 2. Go to Network Tab

### 3. Filter by "Fetch/XHR"

### 4. Find a Failing Request (401 error)

Click on the request that failed (e.g., `GET /api/organizations`)

### 5. Check Request Headers

Scroll down to **"Request Headers"** section and look for:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If you see:**
- ✅ `Authorization: Bearer <long-token>` → Token IS being sent
  - Problem is likely: Token signature mismatch or JWT_SECRET issue
- ❌ No `Authorization` header → Token NOT being sent
  - Problem is: Token provider not working

### 6. Check Console for Warnings

Look for:
- `[HttpClient] No token available for authenticated request to ...`
  - This means token provider returned null/undefined

### 7. Check localStorage

In DevTools → Application → Local Storage → `http://localhost:8070`

Look for key: `proact_auth_state`

Click on it and expand to see:
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "expiresAt": 1234567890
  },
  "user": { ... }
}
```

**If `accessToken` exists:**
- ✅ Token is stored
- Check if it's being retrieved correctly

**If `accessToken` is missing/null:**
- ❌ Token not being stored after login

---

## Expected Flow

1. **Login succeeds** → Token stored in localStorage
2. **Component mounts** → Token loaded from localStorage
3. **API request made** → Token attached to Authorization header
4. **Backend receives** → Validates token

---

## Common Issues

### Issue 1: Token Not in localStorage
- **Solution:** Clear cache, login again

### Issue 2: Token in localStorage but Not Sent
- **Solution:** Check token provider in `AuthContext.tsx`

### Issue 3: Token Sent but Invalid
- **Solution:** Check backend JWT_SECRET matches

---

**Check these in your browser now!** 🔍

