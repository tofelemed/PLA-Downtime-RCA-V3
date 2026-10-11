# 🔧 PI Connection 400 Bad Request Fix

## Problem

You're getting a `400 Bad Request` error:
```
GET http://localhost:8070/piwebapi/assetservers 400 (Bad Request)
```

## Root Cause

The `PIClient` is using a relative path (`/piwebapi`) which resolves against the current browser origin (`localhost:8070`) instead of using the full PI Web API URL from the form.

**Current Code:**
```typescript
// PIIntegration.tsx line 36
const client = new PIClient({ 
  basePath: '/piwebapi',  // ❌ Relative path - resolves to localhost:8070
  authProvider: async () => basicAuthHeader(username, password) 
});
```

**What happens:**
1. User enters baseUrl: `https://piv.hillal-intl.com:8070/piwebapi`
2. But PIClient uses: `basePath: '/piwebapi'`
3. Fetch resolves: `/piwebapi/assetservers` → `http://localhost:8070/piwebapi/assetservers` ❌
4. Should be: `https://piv.hillal-intl.com:8070/piwebapi/assetservers` ✅

## Solution

I've updated the code to use the full `baseUrl` from the form. Here's what changed:

### 1. Updated PIClient to Accept Full Base URL

**File:** `src/services/pi/PIClient.ts`

Now supports both:
- `baseUrl`: Full URL (e.g., `https://piv.hillal-intl.com:8070/piwebapi`) ✅ **NEW**
- `basePath`: Relative path (legacy support)

### 2. Updated PIIntegration to Use baseUrl

**File:** `src/pages/integrations/PIIntegration.tsx`

Changed from:
```typescript
// ❌ OLD - Uses relative path
const client = new PIClient({ 
  basePath: '/piwebapi',
  authProvider: async () => basicAuthHeader(username, password) 
});
```

To:
```typescript
// ✅ NEW - Uses full URL from form
const client = new PIClient({ 
  baseUrl: baseUrl, // Full URL from form: 'https://piv.hillal-intl.com:8070/piwebapi'
  authProvider: async () => basicAuthHeader(username, password) 
});
```

## Additional Issue: CORS

**Important:** If you still get CORS errors after this fix, you should use the backend PI proxy instead of connecting directly.

### Option 1: Use Backend Proxy (Recommended for Production)

The backend already has a PI proxy at `/api/pi-proxy/request` that handles CORS.

**Update PIClient to use proxy:**
```typescript
// Instead of direct PI calls, use backend proxy
const response = await fetch('/api/pi-proxy/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    target: baseUrl, // Full PI Web API URL
    path: '/assetservers',
    method: 'GET',
    username: username,
    password: password
  })
});
```

### Option 2: Enable CORS on PI Web API Server

If you control the PI Web API server, enable CORS headers:
- `Access-Control-Allow-Origin: *` (or your frontend domain)
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE`
- `Access-Control-Allow-Headers: Authorization, Content-Type`

## Testing

1. **Enter correct baseUrl in form:**
   ```
   https://piv.hillal-intl.com:8070/piwebapi
   ```
   (or your actual PI server URL)

2. **Enter username and password**

3. **Click "Test Connection"**

4. **Check browser console:**
   - ✅ Should see: Request to `https://piv.hillal-intl.com:8070/piwebapi/assetservers`
   - ❌ Should NOT see: Request to `http://localhost:8070/piwebapi/assetservers`

## Troubleshooting

### Still getting 400 Bad Request?

1. **Check the baseUrl format:**
   - ✅ Correct: `https://piv.hillal-intl.com:8070/piwebapi`
   - ❌ Wrong: `https://piv.hillal-intl.com:8070` (missing `/piwebapi`)
   - ❌ Wrong: `piv.hillal-intl.com:8070/piwebapi` (missing protocol)

2. **Check PI Web API is accessible:**
   ```bash
   curl -k https://piv.hillal-intl.com:8070/piwebapi/assetservers \
     -u "username:password"
   ```

3. **Check credentials:**
   - Username format: `DOMAIN\username` or `username`
   - Password is correct

4. **Check CORS (if using direct connection):**
   - Browser console will show CORS error if present
   - Solution: Use backend proxy

### Getting CORS errors?

Use the backend PI proxy instead. The proxy endpoint is:
```
POST /api/pi-proxy/request
```

This avoids CORS issues because the backend makes the request (no browser CORS restrictions).

## Next Steps

1. ✅ **Test with the fix** - Try connecting again with the correct baseUrl
2. ⚠️ **If CORS errors appear** - Switch to backend proxy
3. 🔒 **For production** - Always use backend proxy (more secure, avoids CORS)

---

**Status:** ✅ Fixed - PIClient now uses full baseUrl from form

