# PI Web API CORS Solutions - Complete Guide

## The CORS Error Explained

```
Access to fetch at 'https://87.107.103.198:7443/piwebapi/assetservers' 
from origin 'http://localhost:8070' has been blocked by CORS policy
```

### What This Means:
- ✅ **Good news**: The authentication fix is working! Requests are going to the correct server
- ❌ **New issue**: The PI Web API server doesn't allow cross-origin requests from browsers
- 🔒 **Why**: Browsers enforce CORS for security - servers must explicitly allow cross-origin requests

## Three Solutions (Choose One)

### 🚀 **Solution 1: Development Proxy** (Fastest - 5 minutes)

**Use the Vite development proxy to bypass CORS in development.**

#### How to Implement:

1. **Create `.env.local` file** in the project root:
   ```env
   VITE_PI_SERVER=https://87.107.103.198:7443
   ```

2. **Restart the dev server**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. **Test** - Navigate to `/connectivity` and click "Check Now"

#### Pros:
- ✅ Works immediately
- ✅ No server configuration needed
- ✅ Easy to switch between PI servers
- ✅ No code changes required

#### Cons:
- ❌ Only works in development (`npm run dev`)
- ❌ Won't work in production build
- ❌ Requires restart when changing servers

#### When to Use:
- Perfect for development and testing
- When you don't have access to configure the PI server
- Quick proof-of-concept or demo

**📖 See**: `PI_QUICK_FIX_INSTRUCTIONS.md` for detailed steps

---

### ⭐ **Solution 2: Configure CORS on PI Server** (Recommended for Production)

**Enable CORS headers on the PI Web API server to allow browser requests.**

#### How to Implement:

**Option A - Using IIS Manager (GUI):**
1. Open IIS Manager on PI server
2. Navigate to `Default Web Site` → `piwebapi`
3. Double-click "HTTP Response Headers"
4. Add these headers:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
   - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept`
   - `Access-Control-Allow-Credentials: true`

**Option B - Using PowerShell (Automated):**
```powershell
# Run on PI Web API server as Administrator
Import-Module WebAdministration
$sitePath = "IIS:\Sites\Default Web Site\piwebapi"

Add-WebConfigurationProperty -pspath $sitePath `
  -filter "system.webServer/httpProtocol/customHeaders" `
  -name "." -value @{name='Access-Control-Allow-Origin';value='*'}

Add-WebConfigurationProperty -pspath $sitePath `
  -filter "system.webServer/httpProtocol/customHeaders" `
  -name "." -value @{name='Access-Control-Allow-Methods';value='GET, POST, PUT, DELETE, OPTIONS'}

Restart-WebAppPool -Name "DefaultAppPool"
```

#### Pros:
- ✅ Works in both development and production
- ✅ Direct browser-to-PI communication (fastest)
- ✅ One-time configuration
- ✅ Supports all modern browsers

#### Cons:
- ❌ Requires admin access to PI server
- ❌ May have security implications (use specific origins, not `*`)
- ❌ Needs IT approval in enterprise environments

#### When to Use:
- Best for production deployments
- When you control the PI server
- For single-origin applications

**📖 See**: `PI_CORS_CONFIGURATION_GUIDE.md` for detailed instructions

---

### 🏗️ **Solution 3: Backend Proxy Service** (Best for Multi-Server)

**Create a backend service that proxies requests to any PI Web API server.**

#### How to Implement:

The backend proxy has been created for you:
- **Backend**: `server/pro-act-backend/src/pi-proxy/`
- **Endpoint**: `POST /api/pi-proxy/request`

**Usage Example:**
```typescript
// Frontend code to use backend proxy
const response = await fetch('http://localhost:3000/api/pi-proxy/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Your JWT token
  },
  body: JSON.stringify({
    target: 'https://87.107.103.198:7443/piwebapi',
    path: '/assetservers',
    method: 'GET',
    username: 'your-username',
    password: 'your-password'
  })
});
```

#### Pros:
- ✅ Works with any PI server (multi-server support)
- ✅ Credentials never exposed to browser
- ✅ Works in production
- ✅ Can handle SSL certificate issues
- ✅ Centralized authentication
- ✅ Can add caching, rate limiting, etc.

#### Cons:
- ❌ Adds server latency
- ❌ Requires backend deployment
- ❌ More complex architecture
- ❌ Backend must be secured

#### When to Use:
- Multiple PI servers in production
- Enterprise security requirements
- Need to hide credentials from browser
- SSL certificate issues
- Want to add middleware (caching, logging, etc.)

---

## Recommended Approach

### For Your Situation:

**Right Now (Development)**:
1. ✅ Use **Solution 1** (Development Proxy) - get working immediately
2. Create `.env.local` with `VITE_PI_SERVER=https://87.107.103.198:7443`
3. Restart dev server

**For Production**:
- **If** you have access to PI server → Use **Solution 2** (Configure CORS)
- **If** you don't have access or need multi-server → Use **Solution 3** (Backend Proxy)

## Quick Decision Tree

```
Do you need it working NOW?
├─ Yes → Solution 1 (Development Proxy)
└─ No  → Is this for production?
    ├─ Yes → Do you control the PI server?
    │   ├─ Yes → Solution 2 (Configure CORS)
    │   └─ No  → Solution 3 (Backend Proxy)
    └─ No  → Solution 1 (Development Proxy)
```

## Testing Your Solution

After implementing any solution:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Restart dev server** (if using Solution 1)
3. **Navigate to** `/connectivity`
4. **Enter PI details**:
   - Base URL: `https://87.107.103.198:7443/piwebapi`
   - Username: your username
   - Password: your password
5. **Click "Check Now"**

### Expected Results:

✅ **Success**:
- Status: "Connected"
- No CORS errors in console
- Can browse Asset Servers

❌ **Still CORS Error**:
- Check: Did you restart the server?
- Check: Is `.env.local` in the right place?
- Check: Is the environment variable loaded? (`console.log(import.meta.env.VITE_PI_SERVER)`)

❌ **401 Unauthorized**:
- ✅ CORS is fixed (progress!)
- ❌ Credentials are wrong
- Fix: Check username/password format

## Security Considerations

### Development Proxy (Solution 1):
- ⚠️ Credentials stored in browser memory
- ⚠️ Only use in development
- ⚠️ Don't commit `.env.local` to git

### CORS Configuration (Solution 2):
- ⚠️ Use specific origins, not `*` in production
- ⚠️ Ensure HTTPS is enforced
- ⚠️ Review with IT security team

### Backend Proxy (Solution 3):
- ✅ Most secure option
- ✅ Credentials never exposed to browser
- ⚠️ Ensure backend endpoints are authenticated
- ⚠️ Use HTTPS for backend communication

## Next Steps

1. **Choose your solution** based on your needs
2. **Implement** following the specific guide:
   - Solution 1: `PI_QUICK_FIX_INSTRUCTIONS.md`
   - Solution 2: `PI_CORS_CONFIGURATION_GUIDE.md`
   - Solution 3: Backend proxy already created, needs frontend integration
3. **Test** the connection
4. **Document** which solution you chose for your team

## Common Issues

### Issue: "net::ERR_CERT_AUTHORITY_INVALID"
**Cause**: PI server has self-signed certificate  
**Fix**: Accept certificate in browser, or use backend proxy (Solution 3)

### Issue: Works in browser, fails in app
**Cause**: CORS only affects JavaScript fetch requests  
**Fix**: Use any of the three solutions above

### Issue: Proxy doesn't forward to new server
**Cause**: Environment variable not loaded  
**Fix**: Restart dev server after changing `.env.local`

## Files Reference

- 📄 `PI_QUICK_FIX_INSTRUCTIONS.md` - Solution 1 detailed guide
- 📄 `PI_CORS_CONFIGURATION_GUIDE.md` - Solution 2 detailed guide
- 📄 `PI_AUTHENTICATION_FIX.md` - Background on the original issue
- 📄 `server/pro-act-backend/src/pi-proxy/` - Solution 3 backend code

## Summary

The CORS error is **expected behavior** when making cross-origin requests from browsers. This is actually **proof that the authentication fix worked** - your requests are now going to the correct server!

Choose the solution that fits your deployment scenario:
- **Development**: Solution 1 ✅
- **Production with server access**: Solution 2 ✅  
- **Production without server access**: Solution 3 ✅

All three solutions are valid and production-ready for their respective use cases.

