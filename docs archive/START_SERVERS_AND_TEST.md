# 🚀 Start Servers & Test UI Integration

## Quick Start Guide

### Step 1: Start Backend Server

Open a terminal and run:
```bash
cd server/pro-act-backend
npm run start:dev
```

**Wait for this message:**
```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
```

### Step 2: Start Frontend Server

Open a **NEW terminal** (keep backend running) and run:
```bash
# From project root directory
npm run dev
```

**Wait for this message:**
```
➜  Local:   http://localhost:8070/
```

### Step 3: Verify Servers Are Running

Run this command:
```powershell
.\test-ui-integration.ps1
```

You should see:
- ✅ Backend server is running on port 4004
- ✅ Frontend server is running on port 8070

---

## 🧪 Step-by-Step UI Testing

Once both servers are running:

### Test 1: Open Frontend in Browser
1. Open: http://localhost:8070
2. Press **F12** to open DevTools
3. Go to **Network** tab
4. Filter by: **Fetch/XHR**

### Test 2: Test Authentication
1. **Register/Login:**
   - Enter email and password
   - Click Login
   - **Check Network tab:** Should see `POST http://localhost:4004/api/auth/login`
   - **Check Response:** Should contain `access_token`

2. **Verify Token Storage:**
   - Open DevTools → Application tab → Local Storage
   - Should see token stored (or check AuthContext state)

### Test 3: Test User Management
1. Navigate to: User Management page
2. **View Users:**
   - **Check Network:** `GET http://localhost:4004/api/users`
   - Users list should display

3. **Create User:**
   - Click "Add User"
   - Fill form and submit
   - **Check Network:** `POST http://localhost:4004/api/users`
   - **Check Response:** Status 201 Created
   - New user should appear in list

4. **Edit User:**
   - Click Edit on a user
   - Modify and save
   - **Check Network:** `PUT http://localhost:4004/api/users/:id`
   - Changes should reflect

5. **Delete User:**
   - Click Delete
   - Confirm
   - **Check Network:** `DELETE http://localhost:4004/api/users/:id`
   - User should be removed

### Test 4: Test Master Data
1. Navigate to: Master Data → Organizations
2. **Create Organization:**
   - **Check Network:** `POST http://localhost:4004/api/organizations`
3. **View Organizations:**
   - **Check Network:** `GET http://localhost:4004/api/organizations`
4. **Update Organization:**
   - **Check Network:** `PUT http://localhost:4004/api/organizations/:id`
5. **Delete Organization:**
   - **Check Network:** `DELETE http://localhost:4004/api/organizations/:id`

### Test 5: Test Production Module
1. Navigate to: Production → Products
2. Create a product
3. **Check Network:** `POST http://localhost:4004/api/products`

### Test 6: Test RCA Module
1. Navigate to: RCA Module
2. Create an RCA
3. **Check Network:** `POST http://localhost:4004/api/rcas`

---

## ✅ What to Verify

For each test, verify:

- [ ] ✅ Network request goes to: `http://localhost:4004/api/...`
- [ ] ✅ Request method is correct (GET/POST/PUT/DELETE)
- [ ] ✅ Request includes: `Authorization: Bearer <token>` header
- [ ] ✅ Response status is 200/201/204 (success)
- [ ] ✅ UI updates after successful API call
- [ ] ✅ No errors in Console tab
- [ ] ✅ No IndexedDB fallback warnings

---

## 🐛 Common Issues

### Backend Not Starting
- Check database connection in `.env`
- Verify port 4004 is available
- Check for errors in terminal

### Frontend Not Starting
- Verify port 8070 is available
- Check for dependency errors
- Try: `npm install` then `npm run dev`

### CORS Errors
- Backend should already have CORS configured
- Check backend logs for CORS messages
- Verify frontend URL matches allowed origins

### 401 Unauthorized
- Make sure you're logged in
- Check token is being sent in headers
- Try logging in again

---

## 📊 Expected Network Requests

### Authentication
```
POST http://localhost:4004/api/auth/login
POST http://localhost:4004/api/auth/register
```

### User Management
```
GET    http://localhost:4004/api/users
POST   http://localhost:4004/api/users
PUT    http://localhost:4004/api/users/:id
DELETE http://localhost:4004/api/users/:id
```

### Master Data
```
GET    http://localhost:4004/api/organizations
POST   http://localhost:4004/api/organizations
PUT    http://localhost:4004/api/organizations/:id
DELETE http://localhost:4004/api/organizations/:id
```

---

## 📝 Test Results

Create a file: `UI_TEST_RESULTS.md` and document your findings:

```markdown
# UI Integration Test Results
Date: [Date]

## Server Status
- Backend: ✅/❌
- Frontend: ✅/❌

## Authentication
- Login: ✅/❌
- Token Storage: ✅/❌

## User Management
- List: ✅/❌
- Create: ✅/❌
- Edit: ✅/❌
- Delete: ✅/❌

## Issues Found:
- [List issues]
```

---

## 🔗 Related Files

- **Test Script:** `test-ui-integration.ps1`
- **Manual Checklist:** `MANUAL_UI_TEST_CHECKLIST.md`
- **Detailed Plan:** `STEP_BY_STEP_UI_TEST_PLAN.md`

