# 🧪 Step-by-Step UI Integration Test Plan

## Overview
This document outlines a comprehensive step-by-step test plan to verify the UI is working properly with backend endpoints.

---

## 📋 Test Checklist

### Phase 1: Server Setup & Health Checks ✅
- [ ] Backend server running on port 4004
- [ ] Frontend server running on port 8070
- [ ] Backend health endpoint responding
- [ ] API documentation accessible (Swagger)

### Phase 2: Authentication Flow ✅
- [ ] User registration
- [ ] User login
- [ ] Token storage and retrieval
- [ ] Auto token refresh
- [ ] Logout functionality

### Phase 3: User Management ✅
- [ ] View users list
- [ ] Create new user
- [ ] Edit existing user
- [ ] Delete user
- [ ] Filter users by tenant/organization

### Phase 4: Master Data Operations ✅
- [ ] Organizations CRUD
- [ ] Tenants CRUD
- [ ] Units CRUD
- [ ] Assets CRUD
- [ ] Impact Codes CRUD
- [ ] OEE Codes CRUD

### Phase 5: Production Management ✅
- [ ] Products CRUD
- [ ] Production Plans CRUD
- [ ] Production Events CRUD
- [ ] OEE Summaries viewing

### Phase 6: RCA Module ✅
- [ ] Create RCA
- [ ] View RCAs list
- [ ] Update RCA status
- [ ] Add RCA recommendations
- [ ] Upload RCA evidence

### Phase 7: Plant Selection & Context ✅
- [ ] Select organization
- [ ] Select tenant
- [ ] Select unit
- [ ] Select asset
- [ ] Persist selection via API

---

## 🔍 Detailed Test Steps

### Step 1: Verify Servers Are Running

```bash
# Check backend
curl http://localhost:4004/api

# Check frontend
curl http://localhost:8070
```

### Step 2: Test Authentication

**2.1 Register New User**
- Navigate to: http://localhost:8070
- Fill registration form
- Submit
- Verify: User created, redirected to login

**2.2 Login**
- Enter credentials
- Click login
- Verify: Token stored, user redirected to dashboard
- Check DevTools Network tab for: `POST /api/auth/login`

**2.3 Verify Token in Request**
- Open DevTools → Network
- Make any authenticated request
- Verify: `Authorization: Bearer <token>` header present

### Step 3: Test User Management

**3.1 Navigate to User Management**
- Click on "User Management" in navigation
- Verify: Users list loads from API

**3.2 Create User**
- Click "Add User"
- Fill form (name, email, password, role)
- Submit
- Verify: User created, appears in list
- Check Network tab: `POST /api/users` with 201 status

**3.3 Edit User**
- Click edit on a user
- Modify details
- Submit
- Verify: Changes saved, reflected in list
- Check Network tab: `PUT /api/users/:id` with 200 status

**3.4 Delete User**
- Click delete on a user
- Confirm deletion
- Verify: User removed from list
- Check Network tab: `DELETE /api/users/:id` with 200 status

### Step 4: Test Master Data

**4.1 Organizations**
- Navigate to Master Data → Organizations
- Create organization
- Verify: API call to `POST /api/organizations`
- Update organization
- Verify: API call to `PUT /api/organizations/:id`
- Delete organization
- Verify: API call to `DELETE /api/organizations/:id`

**4.2 Tenants**
- Similar flow for Tenants
- Verify all CRUD operations use API

**4.3 Impact Codes**
- Navigate to Master Data → Impact Codes
- Create/Update/Delete
- Verify: API calls to `/api/impact-codes`

### Step 5: Test Production Module

**5.1 Products**
- Navigate to Production → Products
- Create product
- Verify: API call to `POST /api/products`

**5.2 Production Plans**
- Create production plan
- Verify: API integration working

### Step 6: Test RCA Module

**6.1 Create RCA**
- Navigate to RCA Module
- Create new RCA
- Verify: API call to `POST /api/rcas`

**6.2 View RCAs**
- Load RCAs list
- Verify: API call to `GET /api/rcas`

**6.3 Upload Evidence**
- Upload file to RCA evidence
- Verify: API call to `POST /api/rca-evidence/upload`

### Step 7: Test Plant Selection

**7.1 Select Organization**
- Use plant selector
- Select organization
- Verify: Saved via `POST /api/app-settings` with key 'plantSelection'

**7.2 Select Tenant**
- Select tenant within organization
- Verify: Selection persisted

---

## ✅ Success Criteria

For each test:
- ✅ No console errors
- ✅ Network requests show correct endpoint
- ✅ Responses return expected data format
- ✅ UI updates reflect API changes
- ✅ No IndexedDB fallback warnings in console

---

## 🐛 Common Issues to Watch For

1. **CORS Errors**
   - Check backend CORS configuration
   - Verify origin is allowed

2. **401 Unauthorized**
   - Check token is being sent
   - Verify token hasn't expired
   - Check AuthContext

3. **404 Not Found**
   - Verify endpoint URL is correct
   - Check API route exists in backend

4. **500 Server Error**
   - Check backend logs
   - Verify database connection
   - Check request payload format

---

## 📊 Expected Network Calls

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh

### User Management
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Master Data
- `GET /api/organizations` - List organizations
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

---

## 🔄 Testing Workflow

1. Start backend server
2. Start frontend server
3. Open browser to http://localhost:8070
4. Open DevTools (F12) → Network tab
5. Filter by "Fetch/XHR"
6. Follow test steps above
7. Monitor network requests
8. Verify responses

---

## 📝 Notes

- All API calls should go to: `http://localhost:4004/api/...`
- Token should be stored in localStorage or memory
- No IndexedDB operations should occur for production data
- Check browser console for errors or warnings

