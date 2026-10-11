# 🤖 Automated UI Integration Testing Guide

## Overview
This guide helps you test the UI step-by-step to verify it's working properly with backend endpoints.

---

## 🚀 Quick Start

### Step 1: Start Backend Server
```bash
cd server/pro-act-backend
npm run start:dev
```

**Wait for:** `Application is running on: http://localhost:4004`

### Step 2: Start Frontend Server
```bash
# In a new terminal, from project root
npm run dev
```

**Wait for:** `Local: http://localhost:8070/`

### Step 3: Run Server Status Check
```powershell
.\test-ui-integration.ps1
```

### Step 4: Open Browser & Test
1. Open: http://localhost:8070
2. Press F12 to open DevTools
3. Go to Network tab
4. Filter: "Fetch/XHR"
5. Follow: `MANUAL_UI_TEST_CHECKLIST.md`

---

## 🧪 Automated Test Script

The `test-ui-integration.ps1` script checks:
- ✅ Backend server status (port 4004)
- ✅ Frontend server status (port 8070)
- ✅ Backend health endpoint
- ✅ API documentation accessibility
- ✅ Authentication endpoint availability

---

## 📋 Manual Testing Checklist

See: `MANUAL_UI_TEST_CHECKLIST.md` for detailed step-by-step instructions.

### Quick Test Flow:
1. **Authentication** → Register/Login
2. **User Management** → Create/Edit/Delete users
3. **Master Data** → Organizations, Tenants, Codes
4. **Production** → Products, Plans, Events
5. **RCA Module** → Create RCA, Upload evidence
6. **Plant Selection** → Select org/tenant/unit

---

## 🔍 What to Verify

For each UI interaction, check:

1. **Network Tab:**
   - Request goes to: `http://localhost:4004/api/...`
   - Method is correct (GET/POST/PUT/DELETE)
   - Headers include: `Authorization: Bearer <token>`
   - Request payload is correct
   - Response status is 200/201/204

2. **Console Tab:**
   - No errors
   - No warnings about IndexedDB fallbacks
   - API calls logged correctly

3. **UI:**
   - Loading states appear
   - Data displays correctly
   - Success/error messages show
   - UI updates after API response

---

## 🐛 Troubleshooting

### Backend Not Running
```bash
cd server/pro-act-backend
npm run start:dev
```

### Frontend Not Running
```bash
npm run dev
```

### CORS Errors
- Check backend is running on port 4004
- Verify CORS configuration in backend `main.ts`
- Check browser console for exact error

### 401 Unauthorized
- Verify token is stored after login
- Check `Authorization` header is sent
- Try logging in again

### 404 Not Found
- Verify endpoint URL is correct
- Check backend routes exist
- Verify API base URL: `http://localhost:4004/api`

---

## 📊 Test Results Template

Create a file: `UI_TEST_RESULTS.md` and fill in:

```markdown
# UI Integration Test Results
Date: [Date]

## Authentication
- [ ] Registration: ✅/❌
- [ ] Login: ✅/❌
- [ ] Token Storage: ✅/❌

## User Management
- [ ] List Users: ✅/❌
- [ ] Create User: ✅/❌
- [ ] Edit User: ✅/❌
- [ ] Delete User: ✅/❌

## Master Data
- [ ] Organizations: ✅/❌
- [ ] Tenants: ✅/❌
- [ ] Impact Codes: ✅/❌

## Production
- [ ] Products: ✅/❌
- [ ] Production Plans: ✅/❌

## RCA
- [ ] Create RCA: ✅/❌
- [ ] View RCAs: ✅/❌
- [ ] Upload Evidence: ✅/❌

## Issues Found:
- [List any issues]
```

---

## ✅ Success Criteria

All tests pass when:
- ✅ All API calls go to backend (not IndexedDB)
- ✅ Network requests show correct endpoints
- ✅ Responses return expected data
- ✅ UI updates reflect API changes
- ✅ No console errors
- ✅ Authentication works end-to-end

---

## 🔗 Related Files

- **Test Script:** `test-ui-integration.ps1`
- **Manual Checklist:** `MANUAL_UI_TEST_CHECKLIST.md`
- **Detailed Plan:** `STEP_BY_STEP_UI_TEST_PLAN.md`
- **Integration Guide:** `INTEGRATION_QUICK_START.md`

