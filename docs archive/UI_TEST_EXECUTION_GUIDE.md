# 🧪 UI Integration Test - Execution Guide

## Current Status

✅ **Frontend Server**: Running on port 8070
⏳ **Backend Server**: Starting (may take 30-60 seconds)

---

## 🚀 Step-by-Step Testing Process

### Step 1: Wait for Backend to Start

**Check backend status:**
```powershell
.\test-ui-integration.ps1
```

**Or manually check:**
```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:4004/api" -TimeoutSec 2
    Write-Host "✅ Backend is ready!"
} catch {
    Write-Host "⏳ Backend still starting..."
}
```

**Wait for:** "✅ Backend server is running on port 4004"

---

### Step 2: Open Browser & Prepare DevTools

1. **Open:** http://localhost:8070
2. **Press F12** to open DevTools
3. **Go to Network tab**
4. **Filter:** "Fetch/XHR" (to see only API calls)
5. **Check Console tab** for errors

---

### Step 3: Test Authentication

#### 3.1 Login Test
1. On the login page, enter credentials:
   - Email: `admin@example.com` (or any existing user)
   - Password: (your password)
2. Click "Login" button
3. **Verify in Network tab:**
   - ✅ Request: `POST http://localhost:4004/api/auth/login`
   - ✅ Request body: `{ "email": "...", "password": "..." }`
   - ✅ Response status: `200 OK`
   - ✅ Response contains: `access_token` field
4. **Verify in Console:**
   - ✅ No errors
   - ✅ No CORS errors
   - ✅ No IndexedDB warnings

#### 3.2 Verify Token Storage
1. Open DevTools → Application tab → Local Storage
2. **OR** check AuthContext state in React DevTools
3. **Verify:** Token is stored

#### 3.3 Verify Redirect
- ✅ After login, should redirect to Dashboard
- ✅ Navigation menu should be visible
- ✅ User info should be displayed

---

### Step 4: Test User Management

1. Navigate to: **User Management** (from navigation menu)

2. **View Users:**
   - Page loads
   - **Check Network:** `GET http://localhost:4004/api/users`
   - **Verify:** Users list displays
   - **Verify:** Request includes: `Authorization: Bearer <token>`

3. **Create User:**
   - Click "Add User" or "Create User"
   - Fill form:
     - Name: `Test User`
     - Email: `testuser@example.com`
     - Password: `Test123!@#`
     - Role: Select a role
   - Submit
   - **Check Network:** `POST http://localhost:4004/api/users`
   - **Verify:** Status 201 Created
   - **Verify:** New user appears in list

4. **Edit User:**
   - Click "Edit" on a user
   - Change name
   - Submit
   - **Check Network:** `PUT http://localhost:4004/api/users/:id`
   - **Verify:** Status 200 OK
   - **Verify:** Changes reflected in UI

5. **Delete User:**
   - Click "Delete" on a user
   - Confirm
   - **Check Network:** `DELETE http://localhost:4004/api/users/:id`
   - **Verify:** Status 200 OK or 204 No Content
   - **Verify:** User removed from list

---

### Step 5: Test Master Data

1. Navigate to: **Master Data** → **Organizations**

2. **Create Organization:**
   - Click "Add Organization"
   - Fill form (name, code, etc.)
   - Submit
   - **Check Network:** `POST http://localhost:4004/api/organizations`
   - **Verify:** Organization created

3. **View Organizations:**
   - **Check Network:** `GET http://localhost:4004/api/organizations`
   - **Verify:** List displays

4. **Update Organization:**
   - Edit an organization
   - **Check Network:** `PUT http://localhost:4004/api/organizations/:id`

5. **Delete Organization:**
   - Delete an organization
   - **Check Network:** `DELETE http://localhost:4004/api/organizations/:id`

**Repeat for:**
- Tenants (`/api/tenants`)
- Impact Codes (`/api/impact-codes`)
- OEE Codes (`/api/oee-codes`)
- Reason Codes (`/api/reason-codes`)

---

### Step 6: Test Production Module

1. Navigate to: **Production** → **Products**

2. **Create Product:**
   - Add a product
   - **Check Network:** `POST http://localhost:4004/api/products`
   - **Verify:** Product created

3. Navigate to: **Production Plans**
   - Create a production plan
   - **Check Network:** `POST http://localhost:4004/api/production-plans`
   - **Verify:** Plan saved

---

### Step 7: Test RCA Module

1. Navigate to: **RCA Module**

2. **Create RCA:**
   - Click "New RCA"
   - Fill required fields
   - Submit
   - **Check Network:** `POST http://localhost:4004/api/rcas`
   - **Verify:** RCA created

3. **View RCAs:**
   - **Check Network:** `GET http://localhost:4004/api/rcas`
   - **Verify:** RCAs list displays

4. **Update RCA:**
   - Edit an RCA
   - Change status
   - **Check Network:** `PUT http://localhost:4004/api/rcas/:id`

---

### Step 8: Test Plant Selection

1. Use **Plant Selector** component
2. Select an Organization
3. **Check Network:** 
   - `POST/PUT http://localhost:4004/api/app-settings`
   - Request body: `{ key: 'plantSelection', value: {...} }`
4. Select a Tenant
5. **Verify:** Selection persisted via API

---

## ✅ Verification Checklist

For **EVERY** UI action:

- [ ] ✅ Network request appears in DevTools
- [ ] ✅ Request URL: `http://localhost:4004/api/...`
- [ ] ✅ Request method is correct (GET/POST/PUT/DELETE)
- [ ] ✅ Request includes: `Authorization: Bearer <token>` header
- [ ] ✅ Request payload is correct format
- [ ] ✅ Response status: 200/201/204 (success)
- [ ] ✅ Response data is in expected format
- [ ] ✅ UI updates after successful API call
- [ ] ✅ No errors in Console tab
- [ ] ✅ No IndexedDB fallback warnings
- [ ] ✅ No CORS errors

---

## 🐛 Common Issues & Solutions

### Issue: Backend Not Running
**Solution:**
```bash
cd server/pro-act-backend
npm run start:dev
```

### Issue: CORS Error
**Check:**
- Backend is running on port 4004
- CORS is configured in backend `main.ts`
- Frontend URL matches allowed origins

### Issue: 401 Unauthorized
**Check:**
- You're logged in
- Token is being sent in headers
- Token hasn't expired
- Try logging in again

### Issue: 404 Not Found
**Check:**
- Endpoint URL is correct
- Backend route exists
- API base URL: `http://localhost:4004/api`

### Issue: 500 Server Error
**Check:**
- Backend terminal logs
- Database connection
- Request payload format

---

## 📊 Expected Network Pattern

### Successful API Call:
```
Method: POST
URL: http://localhost:4004/api/users
Headers:
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Body: { "name": "...", "email": "..." }
Response: 201 Created
Response Body: { "id": "...", "name": "...", ... }
```

---

## 📝 Document Results

Create: `UI_TEST_RESULTS.md`

```markdown
# UI Integration Test Results
Date: [Date]

## Server Status
- Backend: ✅/❌
- Frontend: ✅/❌

## Test Results

### Authentication
- Login: ✅/❌
- Token Storage: ✅/❌

### User Management
- List: ✅/❌
- Create: ✅/❌
- Update: ✅/❌
- Delete: ✅/❌

### Master Data
- Organizations: ✅/❌
- Tenants: ✅/❌

### Issues Found:
- [List any issues]
```

---

## 🎯 Success Criteria

All tests pass when:
- ✅ All API calls go to backend (not IndexedDB)
- ✅ All CRUD operations work
- ✅ Authentication works end-to-end
- ✅ UI updates correctly
- ✅ No console errors
- ✅ No CORS errors

---

**Ready to test!** Follow this guide step by step.

