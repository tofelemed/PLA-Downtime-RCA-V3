# 🔧 Troubleshooting: "Loading mappings..." Stuck

## Quick Checks

### **1. Check Browser Console (F12)**
Open browser DevTools (F12) and check:
- **Console tab**: Look for error messages starting with `❌` or `⚠️`
- **Network tab**: Check if the API request to `/api/hierarchy-mappings` is being made
  - If the request exists, check the status code (200, 404, 401, 500?)
  - If no request exists, the component might not be loading

### **2. Check Backend Status**
- Is the backend server running?
- Check backend console for errors
- Verify the endpoint `/api/hierarchy-mappings` exists

### **3. Check Authentication**
- Are you logged in?
- Do you have a valid JWT token?
- Check if other API calls work

### **4. Check Tenant ID**
- The component needs `session.tenant.id` to work
- Check console for: `🔍 HierarchyMappingManager useEffect`

---

## Common Issues & Solutions

### **Issue 1: Backend Not Running**
**Symptoms**: Network request fails or times out

**Solution**:
```bash
cd server/pro-act-backend
npm run start:dev
```

### **Issue 2: 401 Unauthorized**
**Symptoms**: Console shows "401 Unauthorized" error

**Solution**:
1. Log out and log back in
2. Clear browser localStorage
3. Check JWT token is valid

### **Issue 3: 404 Not Found**
**Symptoms**: Console shows "404" error

**Possible causes**:
- Backend endpoint doesn't exist
- Backend module not imported
- Route not registered

**Solution**:
1. Check backend is running
2. Verify `HierarchyMappingModule` is imported in `app.module.ts`
3. Check backend logs for route registration

### **Issue 4: No Tenant ID**
**Symptoms**: Console shows "⚠️ No tenant ID available yet"

**Solution**:
- Make sure you're logged in with a user that has a tenant
- Check session data in browser console

### **Issue 5: Database Connection Error**
**Symptoms**: Backend shows database errors

**Solution**:
- Check database is running
- Verify database connection in `.env`
- Run migration if table doesn't exist

---

## Debug Steps

### **Step 1: Check Browser Console**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for messages starting with:
   - `🔍 HierarchyMappingManager useEffect`
   - `🔄 Loading hierarchy mapping data...`
   - `📡 Calling hierarchyMappingService.getMappings...`
   - `❌ Failed to load mappings:`

### **Step 2: Check Network Tab**
1. Go to Network tab in DevTools
2. Filter by "hierarchy-mappings"
3. Check the request:
   - **URL**: Should be `http://localhost:4004/api/hierarchy-mappings?tenantId=...`
   - **Status**: 200 (success), 404 (not found), 401 (unauthorized), 500 (server error)
   - **Response**: Check the response body for error details

### **Step 3: Check Backend Logs**
Look for:
- Route registration: `[NestFactory] Starting Nest application`
- Module loading: `HierarchyMappingModule`
- API requests: Check request logs

### **Step 4: Test API Directly**
Use curl or Postman to test:
```bash
curl -X GET "http://localhost:4004/api/hierarchy-mappings?tenantId=YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or use Swagger UI:
1. Go to `http://localhost:3000/api` (or your backend port)
2. Find "Hierarchy Mappings" section
3. Try the GET endpoint manually

---

## Quick Fixes

### **Fix 1: Reload Page**
Sometimes a simple reload fixes it:
- Press F5 or Ctrl+R
- Or click the "Cancel & Retry" button in the loading screen

### **Fix 2: Clear Browser Cache**
- Clear localStorage
- Hard refresh (Ctrl+Shift+R)

### **Fix 3: Check Backend Module Registration**
Verify in `server/pro-act-backend/src/app.module.ts`:
```typescript
import { HierarchyMappingModule } from './hierarchy-mapping/hierarchy-mapping.module';

@Module({
  imports: [
    // ... other modules
    HierarchyMappingModule, // ← Should be here
  ],
})
```

### **Fix 4: Restart Backend**
If backend was running before migration:
```bash
# Stop backend (Ctrl+C)
# Start again
cd server/pro-act-backend
npm run start:dev
```

---

## Expected Console Output

### **If Working Correctly**:
```
🔍 HierarchyMappingManager useEffect: { hasSession: true, tenantId: "..." }
🔄 Loading hierarchy mapping data... { tenantId: "..." }
📡 Calling hierarchyMappingService.getMappings...
✅ Loaded mappings: 0  (or number of mappings)
✅ Data loaded successfully: { mappings: 0, units: X, assets: Y }
🏁 Loading complete - loading state set to false
```

### **If There's an Error**:
```
🔍 HierarchyMappingManager useEffect: { hasSession: true, tenantId: "..." }
🔄 Loading hierarchy mapping data... { tenantId: "..." }
❌ Failed to load mappings: [Error details]
⚠️ Error loading mappings, continuing with empty array: ...
🏁 Loading complete - loading state set to false
```

---

## Still Stuck?

1. **Share the browser console output** - All the messages with emojis
2. **Share the network request details** - Status code and response
3. **Share backend logs** - Any errors in backend console
4. **Check if backend is running** - Verify port and URL

The component now has detailed logging - check the console for specific error messages!

