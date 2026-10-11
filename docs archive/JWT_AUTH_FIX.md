# 🔧 JWT Authentication Fix

## Problem

After successful login, subsequent API requests are failing with `401 Unauthorized`. The login succeeds, but the JWT token is not being properly attached to subsequent requests.

## Root Cause

In `AuthContext.tsx`, the login flow was calling `buildSession()` before applying tokens. The `buildSession()` function makes API calls to fetch organization/tenant details, but these calls failed because the token wasn't set yet.

## Fix Applied

**File:** `src/contexts/AuthContext.tsx`

**Change:** Reordered the login flow to apply tokens BEFORE calling `buildSession()`:

```typescript
// Before:
const nextSession = await buildSession(response.user, nextTokens);
applyTokens(nextTokens);  // Token applied AFTER buildSession

// After:
applyTokens(nextTokens);  // Token applied FIRST
const nextSession = await buildSession(response.user, nextTokens);
```

## Why This Fixes It

1. **Token is set first**: `applyTokens()` sets `tokensRef.current` immediately
2. **Token provider has access**: The `httpClient.setTokenProvider()` function accesses `tokensRef.current?.accessToken`, so once tokens are applied, subsequent API calls will include the token
3. **buildSession can make authenticated calls**: When `buildSession()` makes API calls to fetch organization/tenant, the token is already available

## How Token Flow Works

1. Login succeeds → receives `access_token` and `refresh_token`
2. `mapTokens()` converts response to `AuthTokens` format
3. `applyTokens()` sets `tokensRef.current = nextTokens`
4. Token provider function (set in `useEffect`) accesses `tokensRef.current?.accessToken`
5. `HttpClient` calls token provider for each request and adds `Authorization: Bearer <token>` header
6. Backend validates JWT token and allows request

## Testing

After this fix:

1. ✅ Login should succeed
2. ✅ Subsequent API calls should work (no more 401 errors)
3. ✅ Organization/tenant details should load automatically
4. ✅ All authenticated endpoints should work

## Expected Behavior

**Before Fix:**
```
Login: ✅ 200 OK
GET /api/organizations: ❌ 401 Unauthorized
GET /api/tenants: ❌ 401 Unauthorized
```

**After Fix:**
```
Login: ✅ 200 OK
GET /api/organizations: ✅ 200 OK
GET /api/tenants: ✅ 200 OK
GET /api/assets: ✅ 200 OK
```

---

**Fix applied! Refresh your browser and try logging in again.** 🔄

