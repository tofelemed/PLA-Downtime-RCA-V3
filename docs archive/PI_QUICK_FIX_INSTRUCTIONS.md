# PI Web API CORS Fix - Quick Instructions

## The Problem

The PI Web API server at `https://87.107.103.198:7443` doesn't have CORS (Cross-Origin Resource Sharing) enabled, which blocks browser requests from your app.

## Quick Fix for Development (5 minutes)

### Step 1: Set Environment Variable

Create a file named `.env.local` in the project root with this content:

```env
# PI Web API Server Configuration
VITE_PI_SERVER=https://87.107.103.198:7443
```

### Step 2: Restart Development Server

1. **Stop** the current dev server (Ctrl+C in the terminal)
2. **Start** it again:
   ```bash
   npm run dev
   ```

### Step 3: Test the Connection

1. Open your app at `http://localhost:8070`
2. Navigate to `/connectivity`
3. Enter your PI credentials and click "Check Now"
4. ✅ It should now work without CORS errors!

## How It Works

The Vite development server now acts as a proxy:
- Your browser makes requests to `http://localhost:8070/piwebapi` (same origin, no CORS)
- Vite proxy forwards them to `https://87.107.103.198:7443/piwebapi`
- The PI server responds to Vite
- Vite forwards the response to your browser

```
Browser → Vite Proxy → PI Server
        ✅ No CORS     ✅ No CORS
```

## Switching Between PI Servers

To use a different PI server, just update `.env.local`:

```env
# For the original server
VITE_PI_SERVER=https://piv.hillal-intl.com:8070

# Or for the IP-based server
VITE_PI_SERVER=https://87.107.103.198:7443

# Or any other PI server
VITE_PI_SERVER=https://your-pi-server.com:443
```

Then restart the dev server.

## Important Notes

⚠️ **This only works in development mode** (`npm run dev`)

For production deployment, you have two options:

### Option A: Enable CORS on PI Server (Recommended)
See `PI_CORS_CONFIGURATION_GUIDE.md` for detailed instructions.

### Option B: Backend Proxy Service
Create a backend service that proxies requests to PI Web API and handles CORS.

## Verifying the Fix

After restarting the dev server, check:

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Navigate to /connectivity** and click "Check Now"
4. **Look for the request** to `/piwebapi/assetservers`
5. **Check the URL** - it should be `http://localhost:8070/piwebapi/assetservers` (not the full PI server URL)
6. **Status should be 200 OK** ✅

## Troubleshooting

### Still getting CORS errors?

**Check:**
- Did you create `.env.local` in the project root? (same folder as `package.json`)
- Did you restart the dev server after creating `.env.local`?
- Is the `VITE_PI_SERVER` value correct with `https://` and the right port?

### Getting 401 Unauthorized?

**This means:**
- ✅ CORS is now working (progress!)
- ❌ Credentials are incorrect

**Fix:**
- Double-check username and password in the /connectivity form
- For domain accounts, use format: `DOMAIN\username`
- Verify the credentials work in a browser first

### Connection timeout?

**Check:**
- Can you access `https://87.107.103.198:7443/piwebapi` in your browser?
- Is the PI Web API service running?
- Are there any firewalls blocking the connection?

## What Changed in the Code

The Vite proxy configuration now uses an environment variable instead of a hardcoded URL:

```typescript
// vite.config.ts
proxy: {
  "/piwebapi": {
    target: process.env.VITE_PI_SERVER || "https://87.107.103.198:7443",
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path,
  },
}
```

This allows you to:
- ✅ Switch PI servers without modifying code
- ✅ Use different servers for different developers
- ✅ Avoid committing server URLs to git
- ✅ Work around CORS in development

## Next Steps

1. **For development**: Use the proxy (this fix) ✅
2. **For production**: Enable CORS on PI server (see `PI_CORS_CONFIGURATION_GUIDE.md`)
3. **Alternative**: Build a backend proxy service for multi-server support

