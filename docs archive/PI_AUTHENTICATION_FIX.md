# PI Web API Authentication Fix

## Problem Summary

The PI Web API integration was experiencing an authentication issue where:
- The connection worked with `https://piv.hillal-intl.com:8070/piwebapi` 
- But failed with `https://87.107.103.198:7443/piwebapi` showing a Windows authentication dialog
- Even though the IP-based URL was accessible in the browser without credentials

## Root Cause

The issue was caused by a **hardcoded proxy configuration** in the Vite development server:

```typescript
// vite.config.ts (lines 11-21)
proxy: {
  "/piwebapi": {
    target: "https://piv.hillal-intl.com:8070",  // HARDCODED!
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path,
  },
}
```

### Why This Caused the Problem

1. **All requests were proxied to the wrong server**: Even when users entered different Base URLs in the UI (like `https://87.107.103.198:7443/piwebapi`), those URLs were stored but **never actually used**
2. **The PIClient always used a relative path**: `basePath: '/piwebapi'` which went through the hardcoded proxy
3. **Credentials sent to wrong server**: Your credentials for `87.107.103.198` were being sent to `piv.hillal-intl.com`, causing authentication failures

## Solution Implemented

### 1. Updated All PIClient Instantiations

Changed all instances from using the hardcoded proxy path to using the actual stored Base URL:

**Before:**
```typescript
const client = new PIClient({ 
  basePath: '/piwebapi',  // Hardcoded proxy path
  authProvider: async () => basicAuthHeader(username, password) 
});
```

**After:**
```typescript
const client = new PIClient({ 
  basePath: cfg.baseUrl || '/piwebapi',  // Use actual stored URL
  authProvider: async () => basicAuthHeader(username, password) 
});
```

### 2. Updated PIClient Fetch Configuration

Enhanced the PIClient to properly handle cross-origin requests:

```typescript
const resp = await fetch(`${this.basePath}${path}`, { 
  ...init, 
  headers,
  credentials: 'omit',  // Don't send browser cookies/credentials
  mode: 'cors'          // Enable CORS for cross-origin requests
});
```

### 3. Files Modified

The following files were updated to use the actual Base URL from configuration:

1. ✅ `src/pages/integrations/PIIntegration.tsx` (2 instances)
2. ✅ `src/pages/Connectivity.tsx`
3. ✅ `src/pages/EnhancedHistorian.tsx` (1 instance - already correct)
4. ✅ `src/pages/Dashboard.tsx`
5. ✅ `src/pages/EventHub.tsx`
6. ✅ `src/components/historian/HistorianMicroTrends.tsx`
7. ✅ `src/components/plant-hierarchy/UnitList.tsx`
8. ✅ `src/services/pi/PIClient.ts`

**Note:** `src/services/pi/AutoPIEventSyncService.ts` was already correct.

## Important Considerations

### 1. CORS (Cross-Origin Resource Sharing)

When making direct requests to PI Web API servers, the browser enforces CORS policies. The PI Web API server must have CORS properly configured to allow requests from your application origin.

**To check PI Web API CORS configuration:**

```powershell
# Check PI Web API CORS settings
Get-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST/Default Web Site/piwebapi' `
  -filter "system.webServer/httpProtocol/customHeaders" -name "."
```

**To enable CORS on PI Web API (if needed):**

1. Open IIS Manager on the PI Web API server
2. Navigate to the `piwebapi` site
3. Open "HTTP Response Headers"
4. Add the following headers:
   - `Access-Control-Allow-Origin: *` (or your specific origin)
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
   - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept`
   - `Access-Control-Allow-Credentials: true`

### 2. SSL/TLS Certificate Issues

If you see certificate errors when connecting to `https://87.107.103.198:7443/piwebapi`, it's because IP addresses cannot have valid SSL certificates. Options:

1. **Use hostname instead**: Configure a DNS hostname for the PI server
2. **Self-signed certificate**: Accept the certificate in your browser first
3. **Development only**: The current configuration has `secure: false` which will be ignored for direct connections

### 3. Authentication Methods

PI Web API supports multiple authentication methods:

- **Basic Authentication** (what we're using): Username/password in Authorization header
- **Windows Authentication**: Uses browser's integrated Windows auth
- **Kerberos**: For enterprise SSO scenarios
- **Anonymous**: Some PI servers allow anonymous read access

If your PI server at `87.107.103.198` is configured for **anonymous access**, you may not need credentials at all. In that case, you can modify the `basicAuthHeader` function to return an empty object:

```typescript
export function basicAuthHeader(username: string, password: string): HeadersInit {
  // If both username and password are empty, return empty headers (anonymous)
  if (!username && !password) {
    return {};
  }
  const token = btoa(`${username}:${password}`);
  return { Authorization: `Basic ${token}` };
}
```

### 4. Network Accessibility

Ensure that:
1. Your client machine can reach `https://87.107.103.198:7443` on the network
2. Firewalls allow HTTPS traffic on port 7443
3. The PI Web API service is running and listening on that port

**Test connectivity:**
```powershell
Test-NetConnection -ComputerName 87.107.103.198 -Port 7443
```

### 5. Development vs Production

**Current Setup (Development with Vite Proxy):**
- The proxy in `vite.config.ts` is only active during `npm run dev`
- For production builds, the proxy won't exist
- This fix enables direct connections that work in both dev and production

**For Production Deployment:**
Consider using a backend proxy service to:
- Avoid exposing credentials in the browser
- Handle CORS without requiring PI server configuration
- Provide better security and credential management
- Support certificate validation and custom SSL handling

## Testing the Fix

1. **Navigate to /connectivity**
2. **Enter your PI Web API details:**
   - Base URL: `https://87.107.103.198:7443/piwebapi`
   - Username: (your username)
   - Password: (your password)
3. **Click "Save Settings"**
4. **Click "Check Now"** to test connectivity

### Expected Behavior

- ✅ No Windows authentication dialog should appear
- ✅ Connection should use the credentials from the form
- ✅ Should work with any PI Web API URL you configure

### Troubleshooting

If you still see issues:

1. **Check browser console** for CORS errors
2. **Verify PI server allows CORS** (see section above)
3. **Test the URL in browser** - you should be prompted for credentials if anonymous is disabled
4. **Check credentials format** - for domain accounts, use `DOMAIN\username` format
5. **Verify SSL certificate** - accept any certificate warnings in browser first

## Why the IP-based URL Works Without Credentials in Browser

If `https://87.107.103.198:7443/piwebapi` works in your browser without prompting for credentials (even in incognito mode), it means:

1. **Anonymous authentication is enabled** on that PI Web API instance
2. **Or** the server is configured to trust your network/IP range
3. **Or** integrated Windows authentication is using your current Windows login automatically

In this case, you might not need to provide credentials at all. Try leaving the username and password fields empty to test anonymous access.

## Proxy Configuration (Future Enhancement)

If you need to support multiple PI servers dynamically, consider implementing a backend proxy that:

1. Accepts the target PI server URL as a parameter
2. Forwards requests with proper authentication
3. Handles SSL/TLS certificate validation
4. Manages CORS headers

Example backend proxy endpoint:
```
POST /api/pi-proxy
{
  "target": "https://87.107.103.198:7443/piwebapi",
  "path": "/assetservers",
  "auth": { "username": "user", "password": "pass" }
}
```

## Summary

The fix changes the PI integration from using a hardcoded proxy (that only worked with one specific server) to using the actual Base URL configured by the user. This enables:

- ✅ Multiple PI servers support
- ✅ Dynamic server configuration
- ✅ Proper credential routing
- ✅ Works in both development and production

The authentication dialog issue should now be resolved, as credentials are being sent to the correct server that you configure in the UI.

