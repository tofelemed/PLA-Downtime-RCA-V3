# 🧪 Manual UI Integration Test Checklist

Use this checklist to manually test the UI step-by-step and verify endpoint integration.

---

## 📋 Pre-Test Setup

- [ ] Backend server running on port 4004
- [ ] Frontend server running on port 8070
- [ ] Browser DevTools open (F12)
- [ ] Network tab filtered to "Fetch/XHR"
- [ ] Console tab open for errors

---

## 🔐 Phase 1: Authentication Tests

### Test 1.1: User Registration
1. Navigate to: http://localhost:8070
2. Open Registration form (if available)
3. Fill in form:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Name: `Test User`
4. Submit form
5. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/auth/register`
   - [ ] Response status: 201 Created
   - [ ] User redirected to login or dashboard
   - [ ] No errors in console

### Test 1.2: User Login
1. Enter credentials:
   - Email: `test@example.com`
   - Password: `Test123!@#`
2. Click "Login"
3. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/auth/login`
   - [ ] Response contains `access_token`
   - [ ] Token stored (check localStorage or Application tab)
   - [ ] User redirected to dashboard
   - [ ] User info displayed in UI

### Test 1.3: Authenticated Request
1. After login, navigate to any page
2. **Verify:**
   - [ ] Network requests include header: `Authorization: Bearer <token>`
   - [ ] Requests succeed (status 200)
   - [ ] No 401 Unauthorized errors

---

## 👥 Phase 2: User Management Tests

### Test 2.1: View Users List
1. Navigate to: User Management page
2. **Verify:**
   - [ ] Network request: `GET http://localhost:4004/api/users`
   - [ ] Users list displays
   - [ ] Loading state shows while fetching
   - [ ] Error handling if request fails

### Test 2.2: Create User
1. Click "Add User" or "Create User"
2. Fill form:
   - Name: `New User`
   - Email: `newuser@example.com`
   - Password: `Password123!`
   - Role: Select a role
3. Submit
4. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/users`
   - [ ] Request body contains user data
   - [ ] Response status: 201 Created
   - [ ] New user appears in list
   - [ ] Success message displayed

### Test 2.3: Edit User
1. Click "Edit" on an existing user
2. Modify name or email
3. Submit changes
4. **Verify:**
   - [ ] Network request: `PUT http://localhost:4004/api/users/:id`
   - [ ] Request body contains updated data
   - [ ] Response status: 200 OK
   - [ ] Changes reflected in UI
   - [ ] Success message displayed

### Test 2.4: Delete User
1. Click "Delete" on a user
2. Confirm deletion
3. **Verify:**
   - [ ] Network request: `DELETE http://localhost:4004/api/users/:id`
   - [ ] Response status: 200 OK or 204 No Content
   - [ ] User removed from list
   - [ ] Success message displayed

---

## 🏢 Phase 3: Master Data Tests

### Test 3.1: Organizations
1. Navigate to: Master Data → Organizations
2. **Create Organization:**
   - Click "Add Organization"
   - Fill form (name, code, etc.)
   - Submit
   - **Verify:** `POST http://localhost:4004/api/organizations`

3. **View Organizations:**
   - **Verify:** `GET http://localhost:4004/api/organizations`

4. **Update Organization:**
   - Edit an organization
   - **Verify:** `PUT http://localhost:4004/api/organizations/:id`

5. **Delete Organization:**
   - Delete an organization
   - **Verify:** `DELETE http://localhost:4004/api/organizations/:id`

### Test 3.2: Tenants
- Same flow as Organizations
- **Verify:** All CRUD operations use `/api/tenants`

### Test 3.3: Impact Codes
- Navigate to: Master Data → Impact Codes
- **Verify:** All operations use `/api/impact-codes`

---

## 🏭 Phase 4: Production Module Tests

### Test 4.1: Products
1. Navigate to: Production → Products
2. Create a product
3. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/products`
   - [ ] Product appears in list

### Test 4.2: Production Plans
1. Navigate to: Production Plans
2. Create a production plan
3. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/production-plans`
   - [ ] Plan saved and displayed

---

## 🔍 Phase 5: RCA Module Tests

### Test 5.1: Create RCA
1. Navigate to: RCA Module
2. Create new RCA
3. Fill in required fields:
   - Title
   - Description
   - Event selection
4. Submit
5. **Verify:**
   - [ ] Network request: `POST http://localhost:4004/api/rcas`
   - [ ] RCA created and displayed
   - [ ] Status shown correctly

### Test 5.2: View RCAs
1. Load RCAs list
2. **Verify:**
   - [ ] Network request: `GET http://localhost:4004/api/rcas`
   - [ ] RCAs displayed in list
   - [ ] Filtering works if available

### Test 5.3: Update RCA
1. Edit an RCA
2. Change status or details
3. Save
4. **Verify:**
   - [ ] Network request: `PUT http://localhost:4004/api/rcas/:id`
   - [ ] Changes saved

---

## 🌳 Phase 6: Plant Selection Tests

### Test 6.1: Select Organization
1. Open Plant Selector
2. Select an organization
3. **Verify:**
   - [ ] Selection saved
   - [ ] Network request: `POST/PUT http://localhost:4004/api/app-settings`
   - [ ] Request body: `{ key: 'plantSelection', value: {...} }`

### Test 6.2: Select Tenant
1. Select tenant within organization
2. **Verify:**
   - [ ] Selection persisted via API
   - [ ] UI updates to show selected tenant

---

## ✅ Verification Checklist

For each test, verify:

- [ ] ✅ Network request goes to correct endpoint
- [ ] ✅ Request includes authentication header (if required)
- [ ] ✅ Request payload is correct format
- [ ] ✅ Response status is 200/201/204 (success)
- [ ] ✅ UI updates after successful request
- [ ] ✅ Error handling works (try invalid data)
- [ ] ✅ Loading states display
- [ ] ✅ No console errors
- [ ] ✅ No IndexedDB fallback warnings

---

## 🐛 Common Issues to Check

### Issue: 401 Unauthorized
- **Check:** Token is being sent in headers
- **Check:** Token hasn't expired
- **Check:** AuthContext is working

### Issue: 404 Not Found
- **Check:** Endpoint URL is correct
- **Check:** Backend route exists
- **Check:** API base URL is correct (`http://localhost:4004/api`)

### Issue: 400 Bad Request
- **Check:** Request payload format
- **Check:** Required fields are included
- **Check:** Data validation on backend

### Issue: 500 Server Error
- **Check:** Backend logs
- **Check:** Database connection
- **Check:** Server console output

---

## 📊 Expected Network Patterns

### Successful Request Pattern:
```
Request: POST http://localhost:4004/api/users
Headers:
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Body: { "name": "...", "email": "..." }
Response: 201 Created
Body: { "id": "...", "name": "...", ... }
```

### Authentication Pattern:
```
Request: POST http://localhost:4004/api/auth/login
Body: { "email": "...", "password": "..." }
Response: 200 OK
Body: { "access_token": "...", "user": {...} }
```

---

## 📝 Test Results Template

### Test: [Component Name]
- **Date:** [Date]
- **Status:** ✅ Pass / ❌ Fail / ⚠️ Partial
- **Network Requests:** [List of endpoints called]
- **Issues Found:** [Any issues]
- **Notes:** [Additional observations]

---

**Remember:** Always check the Network tab in DevTools to verify API calls are being made correctly!

