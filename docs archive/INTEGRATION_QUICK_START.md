# 🚀 Frontend-Backend Integration - Quick Start

## ✅ Prerequisites Check

**Backend Status:**
- ✅ All 128 endpoint tests passing
- ✅ Backend ready on port 3000
- ✅ CORS configured
- ✅ JWT authentication working

**Frontend Status:**
- ✅ HttpClient configured
- ✅ AuthContext implemented
- ✅ API services ready

---

## 🎯 Quick Setup (5 Minutes)

### Step 1: Configure Environment Variables

**Frontend:**
```bash
# Copy example file
cp .env.example .env

# Or create manually with this content:
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env
```

**Backend:**
```bash
# Ensure backend has .env configured
cd server/pro-act-backend
# Check that PORT=3000 is set
```

### Step 2: Start Backend Server

```bash
cd server/pro-act-backend
npm run start:dev
```

**Expected Output:**
```
Application is running on: http://localhost:3000
API documentation available at: http://localhost:3000/api
```

### Step 3: Start Frontend Server

```bash
# In a new terminal, from project root
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:8070/
```

### Step 4: Test Integration

1. **Open Frontend:** http://localhost:8070
2. **Open Backend API Docs:** http://localhost:3000/api
3. **Test Login:**
   - Navigate to login page
   - Register a new user or login
   - Verify token is stored
   - Check browser DevTools Network tab for API calls

---

## 🔍 Verification Checklist

### ✅ Backend Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected:** `{"status":"ok","timestamp":"..."}`

### ✅ Frontend API Connection

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to login
4. Check for API calls to `http://localhost:3000/api/auth/login`
5. Verify response includes JWT token

### ✅ Authentication Flow

1. **Login Request:**
   - Endpoint: `POST http://localhost:3000/api/auth/login`
   - Should return: `{ access_token, refresh_token, user, ... }`

2. **Authenticated Request:**
   - Should include header: `Authorization: Bearer <token>`
   - Should succeed with 200 status

---

## 🐛 Troubleshooting

### Issue: CORS Errors

**Solution:** Backend CORS is already configured. If you see CORS errors:
1. Verify backend is running on port 3000
2. Check browser console for exact error
3. Ensure frontend URL matches CORS origin

### Issue: 401 Unauthorized

**Solution:**
1. Check if JWT token is being sent in headers
2. Verify token hasn't expired
3. Check AuthContext is properly storing tokens

### Issue: Connection Refused

**Solution:**
1. Verify backend is running: `curl http://localhost:3000/api/health`
2. Check `VITE_API_BASE_URL` in frontend `.env`
3. Ensure no firewall blocking port 3000

### Issue: Port Already in Use

**Backend (port 3000):**
```bash
# Windows
netstat -ano | findstr :3000
# Kill process or change PORT in backend .env

# Linux/Mac
lsof -ti:3000 | xargs kill
```

**Frontend (port 8070):**
```bash
# Change port in vite.config.ts
server: {
  port: 8071,  // or any other port
}
```

---

## 📊 Integration Status

| Component | Status | Port | URL |
|-----------|--------|------|-----|
| Backend API | ✅ Ready | 3000 | http://localhost:3000/api |
| Frontend Dev | ✅ Ready | 8070 | http://localhost:8070 |
| Swagger Docs | ✅ Ready | 3000 | http://localhost:3000/api |
| Authentication | ✅ Ready | - | JWT tokens |
| CORS | ✅ Configured | - | All origins allowed |

---

## 📝 Next Steps

1. ✅ **Backend Running** - Start backend server
2. ✅ **Frontend Running** - Start frontend dev server  
3. ✅ **Environment Configured** - Set VITE_API_BASE_URL
4. ✅ **Test Authentication** - Login and verify token
5. 🔄 **Migrate IndexedDB** - Gradually replace IndexedDB calls with backend APIs
6. 🔄 **Add Real-time Updates** - Connect WebSocket for live data

---

## 🔗 Related Documentation

- **Full Integration Guide:** `FRONTEND_BACKEND_INTEGRATION_READY.md`
- **API Documentation:** http://localhost:3000/api (Swagger)
- **Test Report:** `server/pro-act-backend/test-report.json`
- **Backend-Frontend Mapping:** `FRONTEND_BACKEND_COMPARISON_REPORT.md`

---

**You're all set! 🎉**

Both servers are ready. Start them and begin testing the integration.

