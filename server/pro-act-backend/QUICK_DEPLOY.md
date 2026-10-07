# ⚡ Quick Deploy Guide - 15 Minutes to Production

## 🎯 Goal
Get your ProAct backend running in 15 minutes!

---

## ✅ Prerequisites
- Node.js 18+
- MS SQL Server
- 15 minutes

---

## 🚀 Step-by-Step (15 minutes)

### 1️⃣ Configure Environment (2 min)

```bash
cd server/pro-act-backend
cp env.template .env
```

Edit `.env` with your values:
```bash
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword123!
DB_NAME=ProActDB
JWT_SECRET=your-32-char-secret-key-change-this-abc123def456
JWT_REFRESH_SECRET=different-secret-for-refresh-xyz789
```

### 2️⃣ Create Database (3 min)

```sql
-- In SQL Server Management Studio or Azure Data Studio
CREATE DATABASE ProActDB;
GO

USE ProActDB;
GO

-- Run this file:
-- migrations/001-complete-database-schema.sql

-- Verify
SELECT COUNT(*) FROM sys.tables;
-- Should show 50+ tables
```

### 3️⃣ Install Dependencies (3 min)

```bash
npm install
```

### 4️⃣ Start Server (1 min)

```bash
npm run start:dev
```

Wait for:
```
Application is running on: http://localhost:3000
API documentation available at: http://localhost:3000/api
```

### 5️⃣ Create Admin User (2 min)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Admin",
    "email": "admin@proact.com",
    "password": "Admin123!",
    "role": "SuperAdmin",
    "tenantId": "default-tenant",
    "organizationId": "default-org"
  }'
```

### 6️⃣ Login & Test (2 min)

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@proact.com","password":"Admin123!"}'

# Copy access_token from response
# Open: http://localhost:3000/api
# Click "Authorize", paste: Bearer {access_token}
# Test any endpoint!
```

### 7️⃣ Verify Everything (2 min)

Open Swagger: `http://localhost:3000/api`

Check for:
- ✅ 258+ endpoints visible
- ✅ All modules listed
- ✅ Authentication working
- ✅ Can execute any endpoint

---

## ✅ Success!

You should see:
- 🟢 Server running on port 3000
- 🟢 258+ API endpoints in Swagger
- 🟢 Authentication working
- 🟢 All modules loaded
- 🟢 Database connected

---

## 🎉 You're Live!

**Total Time**: 15 minutes

**What's Working**:
- ✅ All 50 modules
- ✅ All 258+ endpoints
- ✅ Full authentication
- ✅ Multi-tenant support
- ✅ Production-ready

**Next Steps**:
1. Test endpoints via Swagger
2. Connect frontend
3. Deploy to production server

---

## 🆘 Troubleshooting

### Server Won't Start
```bash
# Check environment variables
cat .env

# Check database connection
# Verify DB credentials in .env

# Check for port conflicts
netstat -ano | findstr :3000
```

### Database Connection Error
```
✓ Check SQL Server is running
✓ Verify DB_HOST, DB_PORT in .env
✓ Verify DB_USERNAME, DB_PASSWORD
✓ Test connection with SSMS
```

### Authentication Not Working
```
✓ Check JWT_SECRET is set in .env
✓ Verify user was created successfully
✓ Check password matches (case-sensitive)
✓ Verify token format: "Bearer {token}"
```

---

## 🔥 Production Deployment

### Build for Production
```bash
npm run build
npm run start:prod
```

### Using PM2
```bash
npm install -g pm2
pm2 start dist/main.js --name proact-backend
pm2 save
pm2 startup
```

### Docker (Optional)
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

**DEPLOY TIME**: 15 minutes  
**ENDPOINTS**: 258+  
**MODULES**: 50  
**STATUS**: ✅ COMPLETE  

**GO LIVE!** 🚀

