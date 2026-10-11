# 🌐 Browser-Based UI Testing Instructions

## Quick Start

Servers have been started in background. Once they're ready:

### Step 1: Verify Servers
Run: `.\test-ui-integration.ps1`

### Step 2: Open Browser
Navigate to: http://localhost:8070

### Step 3: Open DevTools
- Press **F12**
- Go to **Network** tab
- Filter: **Fetch/XHR**

### Step 4: Test Each Component

Follow the test checklist below:

---

## 🔐 Test 1: Authentication

### Login Test:
1. Enter credentials in login form
2. Click "Login"
3. **Check Network Tab:**
   - Should see: `POST http://localhost:4004/api/auth/login`
   - Request payload: `{ email: "...", password: "..." }`
   - Response: `{ access_token: "...", user: {...} }`
4. **Check Console:** No errors
5. **Verify:** Redirected to dashboard

---

## 👥 Test 2: User Management

### View Users:
1. Navigate to User Management
2. **Check Network:** `GET http://localhost:4004/api/users`
3. **Verify:** Users list displays

### Create User:
1. Click "Add User"
2. Fill form and submit
3. **Check Network:** `POST http://localhost:4004/api/users`
4. **Verify:** User appears in list

### Edit User:
1. Click Edit on a user
2. Modify and save
3. **Check Network:** `PUT http://localhost:4004/api/users/:id`
4. **Verify:** Changes saved

---

## 🏢 Test 3: Master Data

### Organizations:
1. Navigate to Master Data → Organizations
2. Create/Edit/Delete
3. **Verify:** All operations use `/api/organizations`

### Tenants:
- Same as Organizations
- **Verify:** Uses `/api/tenants`

---

## ✅ Success Indicators

- ✅ All API calls go to: `http://localhost:4004/api/...`
- ✅ No IndexedDB operations in console
- ✅ No CORS errors
- ✅ No 401/403/404 errors
- ✅ UI updates correctly
- ✅ Data persists after refresh

---

## 📝 Document Findings

Note any issues you find:
- Which endpoint failed?
- What was the error?
- What was expected vs actual?

---

**Ready to test! Open http://localhost:8070 and start testing.**

