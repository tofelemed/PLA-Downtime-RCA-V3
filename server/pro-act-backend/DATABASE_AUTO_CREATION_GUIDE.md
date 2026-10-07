# 🗄️ Database Auto-Creation Guide

## ❓ Will Tables Be Created Automatically?

### **Current Configuration: NO (Manual Setup Required)** ⚠️

The backend is configured with `synchronize: false` for production safety:

```typescript
// app.module.ts (line 76)
TypeOrmModule.forRoot({
  type: 'mssql',
  // ... other config
  synchronize: false, // ⚠️ Tables will NOT be created automatically
})
```

**This means**:
- ❌ Tables will NOT be created automatically
- ❌ Database will NOT be created automatically
- ✅ You MUST manually create the database
- ✅ You MUST run the migration script

**Why `synchronize: false`?**
- ✅ Production safety (prevents accidental schema changes)
- ✅ Controlled migrations
- ✅ Version control of schema changes
- ✅ No data loss risk

---

## 🎯 THREE SETUP OPTIONS

### **Option 1: Manual Setup (Recommended for Production)** ✅

**Step 1: Create Database Manually**
```sql
-- In SQL Server Management Studio (SSMS)
CREATE DATABASE ProActDB;
GO
```

**Step 2: Run Migration Script**
```sql
USE ProActDB;
GO

-- Execute the complete migration file:
-- File → Open → migrations/001-complete-database-schema.sql
-- Then press F5 or click Execute
```

**Step 3: Verify Tables**
```sql
SELECT COUNT(*) FROM sys.tables;
-- Expected: 50+ tables
```

**Step 4: Start Backend**
```bash
npm run start:dev
```

**Pros**:
- ✅ Full control
- ✅ Production-safe
- ✅ Version controlled
- ✅ Recommended approach

---

### **Option 2: Auto-Create (Development Only)** ⚠️

Enable TypeORM auto-synchronization **ONLY for development**:

**Step 1: Update `app.module.ts`** (temporarily)
```typescript
TypeOrmModule.forRoot({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development', // ✅ Auto-create in dev only
  options: {
    encrypt: false,
  },
})
```

**Step 2: Create Database Manually**
```sql
-- Still need to create database manually
CREATE DATABASE ProActDB;
GO
```

**Step 3: Start Server**
```bash
# Set NODE_ENV
NODE_ENV=development npm run start:dev

# Tables will be created automatically from entities!
```

**Step 4: After Setup, Disable Sync**
```typescript
// Change back to:
synchronize: false,
```

**Pros**:
- ✅ Fast development setup
- ✅ Automatic table creation
- ✅ Schema updates on entity changes

**Cons**:
- ⚠️ Risk of data loss
- ⚠️ Not for production
- ⚠️ Can cause sync issues

---

### **Option 3: Database-First with TypeORM CLI** 🔧

Use TypeORM migrations for controlled schema management:

**Step 1: Install TypeORM CLI**
```bash
npm install -g typeorm
```

**Step 2: Create Migration**
```bash
# Generate migration from entities
typeorm migration:create -n InitialSchema
```

**Step 3: Run Migration**
```bash
typeorm migration:run
```

**Step 4: For Future Changes**
```bash
# Generate migration from entity changes
typeorm migration:generate -n AddNewFeature

# Run migrations
typeorm migration:run

# Revert if needed
typeorm migration:revert
```

**Pros**:
- ✅ Version controlled migrations
- ✅ Safe schema updates
- ✅ Rollback capability
- ✅ Production-ready

---

## 🚀 RECOMMENDED SETUP PROCESS

### **For Production: Manual Approach** (5-10 minutes)

```bash
# 1. Create database (SSMS or Azure Portal)
CREATE DATABASE ProActDB;

# 2. Run migration script
USE ProActDB;
-- Execute: migrations/001-complete-database-schema.sql

# 3. Verify
SELECT COUNT(*) FROM sys.tables;
-- Should show 50+ tables

# 4. Configure .env
DB_HOST=your-server
DB_PORT=1433
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_NAME=ProActDB

# 5. Start backend
npm run start:dev

# 6. Verify connection
# Check console for: "Database connection established"
```

✅ **Safe, controlled, production-ready**

---

### **For Development: Auto-Sync Approach** (2 minutes)

```bash
# 1. Create database manually
CREATE DATABASE ProActDB;

# 2. Enable auto-sync temporarily
# In app.module.ts:
synchronize: true,  // ⚠️ Development only!

# 3. Start server
npm run start:dev

# 4. Tables created automatically! ✅

# 5. Disable auto-sync after setup
synchronize: false,

# 6. Export schema for migration
# Use SSMS to generate CREATE scripts
```

⚠️ **Fast but risky - use only in development**

---

## 🛠️ Complete Setup Script

### **Automated Setup Script for MSSQL**

**File**: `setup-database.sql`

```sql
-- =============================================
-- ProAct Database Setup Script
-- Run this entire script to set up everything
-- =============================================

-- 1. Create database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ProActDB')
BEGIN
    CREATE DATABASE ProActDB;
    PRINT '✓ Created database ProActDB';
END
ELSE
BEGIN
    PRINT '⚠ Database ProActDB already exists';
END
GO

-- 2. Use the database
USE ProActDB;
GO

-- 3. Create all tables (from migration script)
-- Execute: migrations/001-complete-database-schema.sql

-- 4. Verify setup
PRINT '';
PRINT '==============================================';
PRINT 'Database Setup Verification';
PRINT '==============================================';

PRINT 'Database: ProActDB';
PRINT 'Tables Created: ' + CAST((SELECT COUNT(*) FROM sys.tables) AS VARCHAR(10));
PRINT '';

SELECT 
    'Table Count' as Metric,
    COUNT(*) as Value
FROM sys.tables
UNION ALL
SELECT 
    'Index Count' as Metric,
    COUNT(*) as Value
FROM sys.indexes
WHERE type > 0  -- Exclude heaps
UNION ALL
SELECT 
    'Foreign Key Count' as Metric,
    COUNT(*) as Value
FROM sys.foreign_keys;

PRINT '';
PRINT '✓ Database setup complete!';
PRINT 'Next step: Start backend with npm run start:dev';
PRINT '==============================================';
GO
```

**Usage**:
```bash
# In SSMS
# File → Open → setup-database.sql
# Execute (F5)
```

---

## 🔄 Migration Approaches Comparison

| Approach | Database Creation | Table Creation | Production Safe | Recommended |
|----------|-------------------|----------------|-----------------|-------------|
| **Manual + Script** | Manual | Manual Script | ✅ Yes | ✅ **Yes** |
| **Auto Sync** | Manual | Automatic | ❌ No | ⚠️ Dev Only |
| **TypeORM Migrations** | Manual | Migration CLI | ✅ Yes | ✅ Yes |

---

## 📋 Step-by-Step Setup (Complete)

### **Step 1: Install SQL Server** (if not installed)

**Option A: SQL Server Express (Free)**
1. Download: https://www.microsoft.com/sql-server/sql-server-downloads
2. Choose "Express" edition
3. Install with default settings
4. Note: Instance name (usually `SQLEXPRESS`)

**Option B: SQL Server Developer (Free for Dev)**
1. Download: Same link as above
2. Choose "Developer" edition
3. Full enterprise features
4. Free for development

**Option C: Azure SQL Database (Cloud)**
1. Go to Azure Portal
2. Create SQL Database
3. Note connection string
4. No local installation needed

---

### **Step 2: Install Management Tool**

**SQL Server Management Studio (SSMS)**
1. Download: https://docs.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms
2. Install
3. Connect to localhost

**Or Azure Data Studio (Cross-platform)**
1. Download: https://docs.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio
2. Install
3. More modern UI

---

### **Step 3: Create Database**

**In SSMS or Azure Data Studio**:
```sql
-- Connect to server
-- Right-click "Databases" → New Database → "ProActDB"

-- Or run SQL:
CREATE DATABASE ProActDB;
GO
```

✅ **Database created**

---

### **Step 4: Run Migration Script**

```sql
-- Method 1: Via UI
USE ProActDB;
GO

-- File → Open → Select: migrations/001-complete-database-schema.sql
-- Press F5 or click Execute

-- Method 2: Via Command Line
sqlcmd -S localhost -d ProActDB -i "migrations/001-complete-database-schema.sql"
```

✅ **50 tables created with all indexes**

---

### **Step 5: Verify Setup**

```sql
USE ProActDB;
GO

-- Check table count
SELECT COUNT(*) as TableCount FROM sys.tables;
-- Expected: 50+

-- List all tables
SELECT name FROM sys.tables ORDER BY name;

-- Verify specific tables
SELECT 
    'users' as TableName, 
    CASE WHEN OBJECT_ID('users') IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as Status
UNION ALL
SELECT 'products', CASE WHEN OBJECT_ID('products') IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'rcas', CASE WHEN OBJECT_ID('rcas') IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END;
```

✅ **All tables verified**

---

### **Step 6: Configure Backend**

**Create `.env` file**:
```bash
cd server/pro-act-backend
cp env.template .env
```

**Edit `.env`**:
```bash
# For local SQL Server
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword123!
DB_NAME=ProActDB

# For SQL Server Express (named instance)
DB_HOST=localhost\\SQLEXPRESS
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword123!
DB_NAME=ProActDB

# For Azure SQL
DB_HOST=your-server.database.windows.net
DB_PORT=1433
DB_USERNAME=your-admin
DB_PASSWORD=YourAzurePassword!
DB_NAME=ProActDB

# JWT Secrets (Required!)
JWT_SECRET=your-32-character-secret-key-change-this-abc123
JWT_REFRESH_SECRET=different-refresh-secret-xyz789
```

✅ **Backend configured**

---

### **Step 7: Install & Start**

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

**Expected console output**:
```
[Nest] 12345  - 10/18/2025, 12:00:00 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 10/18/2025, 12:00:00 PM     LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 10/18/2025, 12:00:00 PM     LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
API documentation available at: http://localhost:3000/api
```

✅ **Backend running**

---

### **Step 8: Verify Everything**

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Open Swagger
http://localhost:3000/api

# Register admin user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@proact.com",
    "password": "Admin123!",
    "role": "SuperAdmin",
    "tenantId": "default-tenant",
    "organizationId": "default-org"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@proact.com","password":"Admin123!"}'
```

✅ **Everything working!**

---

## ⚡ QUICK SETUP (3 Commands)

```sql
-- 1. In SSMS (30 seconds)
CREATE DATABASE ProActDB;
GO
USE ProActDB;
-- Execute: migrations/001-complete-database-schema.sql
```

```bash
# 2. Configure .env (1 minute)
cd server/pro-act-backend
cp env.template .env
# Edit with your DB credentials

# 3. Start (2 minutes)
npm install
npm run start:dev
```

**Total Time**: 3-4 minutes

---

## 🔧 Troubleshooting

### **Error: Cannot connect to database**

**Problem**: Backend can't connect to SQL Server

**Solution**:
```bash
# Check SQL Server is running
sc query MSSQLSERVER

# Or for named instance
sc query MSSQL$SQLEXPRESS

# Start if stopped
net start MSSQLSERVER
```

---

### **Error: Login failed for user**

**Problem**: Invalid credentials

**Solution**:
```sql
-- Enable SQL Server Authentication
-- 1. Right-click server in SSMS
-- 2. Properties → Security
-- 3. Choose "SQL Server and Windows Authentication mode"
-- 4. Restart SQL Server service

-- Create login if needed
USE master;
CREATE LOGIN proact_admin WITH PASSWORD = 'YourPassword123!';
GO

USE ProActDB;
CREATE USER proact_admin FOR LOGIN proact_admin;
GO

EXEC sp_addrolemember 'db_owner', 'proact_admin';
GO
```

---

### **Error: Database does not exist**

**Problem**: ProActDB not created

**Solution**:
```sql
-- Create it manually
CREATE DATABASE ProActDB;
GO

-- Or check if it exists
SELECT name FROM sys.databases WHERE name = 'ProActDB';
```

---

### **Error: Invalid object name 'users'**

**Problem**: Tables not created

**Solution**:
```sql
-- Tables weren't created. Run migration script:
USE ProActDB;
GO

-- Execute: migrations/001-complete-database-schema.sql
-- Check output for any errors
```

---

## 🎯 ENABLING AUTO-CREATION (Development Only)

If you want tables to be created automatically during development:

### **Method 1: Enable Synchronize (Quick & Easy)**

**Update `app.module.ts`**:
```typescript
TypeOrmModule.forRoot({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  
  // ⚠️ DEVELOPMENT ONLY!
  synchronize: process.env.NODE_ENV === 'development',
  
  // Optional: See SQL queries
  logging: process.env.NODE_ENV === 'development',
  
  options: {
    encrypt: false,
  },
})
```

**Update `.env`**:
```bash
NODE_ENV=development
```

**Now when you start the server**:
```bash
npm run start:dev
# Tables will be created automatically! ✅
```

**⚠️ WARNING**: 
- Only use in development
- Set `synchronize: false` before deploying
- Can cause data loss if schema changes

---

### **Method 2: TypeORM Migrations (Production-Safe)**

**Step 1: Add migration scripts to `package.json`**:
```json
{
  "scripts": {
    "migration:generate": "typeorm migration:generate -d src/data-source.ts -n",
    "migration:run": "typeorm migration:run -d src/data-source.ts",
    "migration:revert": "typeorm migration:revert -d src/data-source.ts"
  }
}
```

**Step 2: Create data source file**:

**File**: `src/data-source.ts`
```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  options: {
    encrypt: false,
  },
});
```

**Step 3: Generate migration**:
```bash
npm run migration:generate InitialSchema
```

**Step 4: Run migration**:
```bash
npm run migration:run
```

**Future updates**:
```bash
# After changing entities
npm run migration:generate AddNewField
npm run migration:run
```

---

## 📊 Database Creation Checklist

### Manual Setup (Recommended)
- [ ] SQL Server installed and running
- [ ] SSMS or Azure Data Studio installed
- [ ] Created database: `CREATE DATABASE ProActDB;`
- [ ] Ran migration: `migrations/001-complete-database-schema.sql`
- [ ] Verified tables: `SELECT COUNT(*) FROM sys.tables;` (should be 50+)
- [ ] Configured `.env` with DB credentials
- [ ] Configured JWT secrets in `.env`
- [ ] Ran `npm install`
- [ ] Tested connection: `npm run start:dev`
- [ ] Verified in console: "Database connection established"
- [ ] Tested via Swagger: `http://localhost:3000/api`

### Auto-Sync Setup (Development)
- [ ] Created database: `CREATE DATABASE ProActDB;`
- [ ] Updated `app.module.ts`: `synchronize: true`
- [ ] Set `NODE_ENV=development`
- [ ] Started server: `npm run start:dev`
- [ ] Verified tables created
- [ ] Changed back: `synchronize: false`

---

## 🎯 SUMMARY

### **Will It Auto-Create Tables?**

**Current Configuration**: ❌ **NO**
- `synchronize: false` (production-safe)
- You must create database manually
- You must run migration script manually

### **Can It Auto-Create Tables?**

**Yes, but only if you enable it**: ✅
- Set `synchronize: true` (development only)
- Still need to create database manually
- Tables will auto-create from entities
- ⚠️ Not recommended for production

### **What MUST Be Created Manually?**
1. ✅ **Database** - Always manual (`CREATE DATABASE ProActDB;`)
2. ⚠️ **Tables** - Manual (via migration) OR Auto (if sync enabled)
3. ⚠️ **Indexes** - Manual (via migration) OR Auto (if sync enabled)
4. ⚠️ **Foreign Keys** - Manual (via migration) OR Auto (if sync enabled)

### **Recommended Approach**
1. Create database manually
2. Run migration script manually
3. Keep `synchronize: false`
4. Use migration scripts for changes

---

## 🚀 FASTEST SETUP (No Auto-Create)

```bash
# === IN SQL SERVER (2 minutes) ===
# Open SSMS, connect to localhost, then:
CREATE DATABASE ProActDB;
GO
USE ProActDB;
GO
-- Execute: migrations/001-complete-database-schema.sql

# === IN TERMINAL (3 minutes) ===
cd server/pro-act-backend
cp env.template .env
# Edit .env with DB credentials
npm install
npm run start:dev

# === DONE! === ✅
```

**Total Time**: 5 minutes
**Tables Created**: 50
**Status**: Production-ready

---

## 🔍 Verify Database Setup

### Quick Verification SQL
```sql
USE ProActDB;

-- Check table count
SELECT COUNT(*) as TotalTables FROM sys.tables;
-- Expected: 50+

-- Check specific tables
SELECT name FROM sys.tables 
WHERE name IN (
    'users', 'organizations', 'tenants', 'units', 'assets',
    'rcas', 'products', 'production_events',
    'rca_trigger_configs', 'five_why_analyses',
    'pi_connections', 'custom_attribute_definitions',
    'query_history'
)
ORDER BY name;
-- Should show all listed tables

-- Check indexes
SELECT 
    t.name as TableName,
    COUNT(i.index_id) as IndexCount
FROM sys.tables t
LEFT JOIN sys.indexes i ON t.object_id = i.object_id
WHERE i.type > 0
GROUP BY t.name
ORDER BY COUNT(i.index_id) DESC;
-- All tables should have indexes
```

---

## 🎯 QUICK ANSWERS

### Q: Will the database be created automatically?
**A**: ❌ **NO** - You must create it manually with `CREATE DATABASE ProActDB;`

### Q: Will tables be created automatically?
**A**: ❌ **NO** (by default) - You must run the migration script
**But**: ✅ **YES** if you enable `synchronize: true` (development only)

### Q: What's the recommended approach?
**A**: ✅ Create database manually + Run migration script
- Safe for production
- Version controlled
- No surprises

### Q: How long does setup take?
**A**: ⏱️ **5 minutes** with manual approach

### Q: Can I use a different database?
**A**: ✅ **YES** - PostgreSQL, MySQL, Oracle all supported (see DATABASE_SUPPORT_GUIDE.md)

---

## 📄 Complete Setup Files

### You Have
- ✅ `migrations/001-complete-database-schema.sql` - All 50 tables
- ✅ `env.template` - Configuration template
- ✅ All entity files (*.entity.ts) - Schema definitions
- ✅ `app.module.ts` - Database connection config

### You Need to Create
- ⚠️ `.env` - Copy from env.template and configure
- ⚠️ Database - Run `CREATE DATABASE ProActDB;`
- ⚠️ Tables - Run migration script

**Setup Time**: 5 minutes total

---

## 🎉 CONCLUSION

**Current Setup**:
- ✅ Database: MS SQL Server (MSSQL)
- ✅ Auto-create: **Disabled** (production-safe)
- ✅ Migration: Manual script provided
- ✅ Setup Time: 5 minutes

**You MUST**:
1. Create database manually (`CREATE DATABASE ProActDB;`)
2. Run migration script (`migrations/001-complete-database-schema.sql`)
3. Configure `.env` with credentials
4. Start backend (`npm run start:dev`)

**Result**: Production-ready database with all 50 tables! ✅

---

**See Also**:
- **DATABASE_SUPPORT_GUIDE.md** - Complete database options
- **QUICK_DEPLOY.md** - 15-minute deployment guide
- **migrations/001-complete-database-schema.sql** - All table creation

**Ready to setup?** Follow the steps above! 🚀

