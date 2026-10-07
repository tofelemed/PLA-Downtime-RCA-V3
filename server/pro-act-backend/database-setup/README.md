# 🚀 ProAct Database Automated Setup

Complete automated database creation for ProAct backend.

## ⚡ Quick Setup (1 Command)

### **Windows Batch (Recommended)**
```batch
cd server\pro-act-backend
database-setup\setup-database.bat
```

### **Windows PowerShell**
```powershell
cd server\pro-act-backend
.\database-setup\setup-database.ps1
```

**That's it!** The script automatically:
✅ Creates database `ProActDB`
✅ Creates all 50 tables with all fields
✅ Creates 150+ indexes
✅ Verifies setup
✅ Shows status

---

## 📋 What Gets Created

**Database**: `ProActDB`
**Tables**: 50 (all with complete fields)
**Indexes**: 150+
**Status**: Production-ready

### Table Categories:
- ✅ Core Entities (6 tables)
- ✅ Master Data (5 tables)
- ✅ Production (9 tables)
- ✅ RCA Modules (10 tables)
- ✅ Analysis Tools (6 tables)
- ✅ PI Integration (8 tables)
- ✅ Custom Attributes (2 tables)
- ✅ Integrations (1 table)
- ✅ Historian (1 table)
- ✅ Settings (2 tables)

---

## 🎯 Prerequisites

1. **SQL Server** installed (Express, Developer, or Standard)
2. **SQL Server running**
3. **Windows Authentication** enabled (or update script for SQL auth)

---

## 📝 After Setup

### 1. Configure `.env`:
```bash
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword
DB_NAME=ProActDB

JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret
```

### 2. Start Backend:
```bash
npm install
npm run start:dev
```

### 3. Access Swagger:
```
http://localhost:3000/api
```

---

## ✅ Verification

Check `database-setup\setup-log.txt` for complete output.

### Manual Verification:
```sql
USE ProActDB;

-- Count tables
SELECT COUNT(*) FROM sys.tables;
-- Expected: 50

-- List tables
SELECT name FROM sys.tables ORDER BY name;

-- Count indexes
SELECT COUNT(*) FROM sys.indexes WHERE type > 0;
-- Expected: 150+
```

---

## 🔧 Manual Setup (Optional)

If you prefer manual setup:

```bash
# Connect to SQL Server
sqlcmd -S localhost -E

# Run setup script
:r database-setup\complete-automated-setup.sql
```

---

## 📂 Files

- `complete-automated-setup.sql` - Complete database script
- `setup-database.bat` - Windows batch automation
- `setup-database.ps1` - PowerShell automation
- `README.md` - This file

---

## ✓ Complete!

Your database is ready for the ProAct backend!

