# 🤖 ProAct - Automated Database Setup Guide

## 🎯 ONE COMMAND SETUP

Create complete SQL Server database with all 50 tables automatically!

---

## ⚡ Quick Start (30 seconds)

### **Option 1: Windows Batch Script** (Easiest)

```batch
cd server\pro-act-backend
database-setup\setup-database.bat
```

### **Option 2: PowerShell Script** (Alternative)

```powershell
cd server\pro-act-backend
.\database-setup\setup-database.ps1
```

### **Option 3: Direct SQL** (Manual)

```bash
sqlcmd -S localhost -E -i database-setup\complete-automated-setup.sql
```

---

## ✅ What Happens Automatically

1. ✅ **Checks SQL Server** is running
2. ✅ **Creates database** `ProActDB` (if not exists)
3. ✅ **Creates all 50 tables** with all fields:
   - organizations
   - tenants
   - users
   - units
   - assets
   - audit_logs
   - impact_codes
   - oee_codes
   - rca_cause_codes
   - verification_status_codes
   - reason_codes
   - products
   - production_plans
   - production_plan_templates
   - production_events
   - production_losses
   - oee_summaries
   - reconcile_forms
   - loss_categories
   - unmapped_events
   - rcas
   - rca_recommendations
   - rca_evidence
   - logic_tree_nodes
   - rca_trigger_configs
   - rca_knowledge_base
   - rca_analysis_configs
   - rca_templates
   - evidence_categories
   - evidence_locations
   - five_why_analyses
   - fishbone_diagrams
   - fmea_analyses
   - fault_tree_analyses
   - barrier_analyses
   - change_analyses
   - pi_connections
   - pi_af_elements
   - af_bindings
   - pi_events
   - pi_mappings
   - pi_sync_watermarks
   - pi_sync_jobs
   - historian_tags
   - custom_attribute_definitions
   - custom_attribute_values
   - data_sources
   - query_history
   - app_settings
   - dashboard_configurations

4. ✅ **Creates 150+ indexes** for performance
5. ✅ **Verifies setup** completed successfully
6. ✅ **Shows status** and next steps

---

## 📋 Prerequisites

### Required:
- ✅ Windows OS
- ✅ SQL Server (Express, Developer, Standard, or Enterprise)
- ✅ SQL Server running
- ✅ SQL Server Management Studio (optional, for verification)

### Check if SQL Server is Running:

```powershell
# PowerShell
Get-Service MSSQLSERVER

# OR Batch
sc query MSSQLSERVER
```

If not running:
```powershell
# Start SQL Server
net start MSSQLSERVER
```

---

## 🎬 Step-by-Step Walkthrough

### Step 1: Navigate to Backend Directory

```batch
cd server\pro-act-backend
```

### Step 2: Run Automated Setup

```batch
database-setup\setup-database.bat
```

### Step 3: Watch the Magic! ✨

```
==============================================
ProAct Database Automated Setup
==============================================

Step 1: Checking SQL Server connection...
  ✓ SQL Server is running

Step 2: Running database setup script...
  This will create database and all 50 tables...

✓ Created: organizations
✓ Created: tenants
✓ Created: users
...
✓ Created: dashboard_configurations

✓ Core entities completed (6/50)
✓ Master data entities completed (11/50)
✓ Production entities completed (20/50)
✓ RCA entities completed (30/50)
✓ Analysis tool entities completed (36/50)
✓ PI Integration entities completed (44/50)
✓ Custom attributes completed (46/50)
✓ Integration entities completed (47/50)
✓ Historian history completed (48/50)
✓ Settings entities completed (50/50)

==============================================
DATABASE SETUP VERIFICATION
==============================================

Total Tables Created: 50
Expected: 50
✓ SUCCESS: All tables created!

Total Indexes: 153
Expected: 150+

==============================================
✓✓✓ DATABASE SETUP COMPLETE! ✓✓✓
==============================================

Database: ProActDB
Tables: 50
Status: READY
```

### Step 4: Configure Environment

Create `.env` file:

```bash
# Database
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword
DB_NAME=ProActDB

# JWT
JWT_SECRET=your-super-secret-key-minimum-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-key
```

### Step 5: Start Backend

```bash
npm install
npm run start:dev
```

### Step 6: Access Swagger UI

Open browser:
```
http://localhost:3000/api
```

✅ **Done! Backend is fully operational!**

---

## 🔍 Verification

### Check Tables (SQL Server Management Studio):

```sql
USE ProActDB;
SELECT COUNT(*) AS TotalTables FROM sys.tables;
-- Expected: 50
```

### List All Tables:

```sql
SELECT name FROM sys.tables ORDER BY name;
```

### Check Indexes:

```sql
SELECT COUNT(*) AS TotalIndexes 
FROM sys.indexes 
WHERE type > 0;
-- Expected: 150+
```

### Verify Sample Table:

```sql
SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users';
```

---

## 📊 Table Details

### Core Entities (6 tables):
- `organizations` - Multi-org support
- `tenants` - Multi-tenant support
- `users` - User management with roles
- `units` - Production units
- `assets` - Equipment and assets
- `audit_logs` - Complete audit trail

### Master Data (5 tables):
- `impact_codes`
- `oee_codes`
- `rca_cause_codes`
- `verification_status_codes`
- `reason_codes`

### Production (9 tables):
- `products`
- `production_plans`
- `production_plan_templates`
- `production_events`
- `production_losses`
- `oee_summaries`
- `reconcile_forms`
- `loss_categories`
- `unmapped_events`

### RCA (10 tables):
- `rcas`
- `rca_recommendations`
- `rca_evidence`
- `logic_tree_nodes`
- `rca_trigger_configs`
- `rca_knowledge_base`
- `rca_analysis_configs`
- `rca_templates`
- `evidence_categories`
- `evidence_locations`

### Analysis Tools (6 tables):
- `five_why_analyses`
- `fishbone_diagrams`
- `fmea_analyses`
- `fault_tree_analyses`
- `barrier_analyses`
- `change_analyses`

### PI Integration (8 tables):
- `pi_connections`
- `pi_af_elements`
- `af_bindings`
- `pi_events`
- `pi_mappings`
- `pi_sync_watermarks`
- `pi_sync_jobs`
- `historian_tags`

### Others (6 tables):
- `custom_attribute_definitions`
- `custom_attribute_values`
- `data_sources`
- `query_history`
- `app_settings`
- `dashboard_configurations`

---

## 🚨 Troubleshooting

### Error: "SQL Server is not running"

**Solution**:
```batch
net start MSSQLSERVER
```

### Error: "Cannot connect to SQL Server"

**Solutions**:
1. Check SQL Server is installed
2. Verify SQL Server service is running
3. Enable Windows Authentication
4. Or use SQL Authentication:

```batch
sqlcmd -S localhost -U sa -P YourPassword -i database-setup\complete-automated-setup.sql
```

### Error: "Database already exists"

**No problem!** The script is idempotent - it will:
- Use existing database
- Create missing tables
- Skip existing tables

To start fresh:
```sql
-- CAREFUL: This deletes everything!
DROP DATABASE ProActDB;
-- Then run setup script again
```

### Error: "Permission denied"

**Solution**: Run as Administrator
- Right-click PowerShell/Command Prompt
- Select "Run as Administrator"
- Run setup script again

---

## 🎯 Features

### ✅ Idempotent
Run multiple times safely - won't recreate existing tables

### ✅ Complete
All 50 tables with all fields, constraints, and indexes

### ✅ Validated
Includes verification step to ensure everything is created

### ✅ Logged
Creates `setup-log.txt` with complete output

### ✅ Safe
Uses `IF NOT EXISTS` checks throughout

---

## 📁 Files Created

```
server/pro-act-backend/
├── database-setup/
│   ├── complete-automated-setup.sql  (Main SQL script)
│   ├── setup-database.bat           (Windows batch automation)
│   ├── setup-database.ps1           (PowerShell automation)
│   ├── setup-log.txt               (Generated - setup log)
│   └── README.md                   (Quick reference)
└── AUTOMATED_DATABASE_SETUP_GUIDE.md (This guide)
```

---

## ✨ Summary

### Before Running Script:
❌ No database
❌ No tables
❌ No indexes

### After Running Script (30 seconds):
✅ Database `ProActDB` created
✅ 50 tables with all fields
✅ 150+ performance indexes
✅ All constraints and relationships
✅ Ready for backend startup

### Total Time: **30 seconds**
### Manual Effort: **ZERO**

---

## 🎉 That's It!

Your ProAct database is fully automated and ready to use!

**Next**: Start the backend with `npm run start:dev` and access http://localhost:3000/api

---

## 📞 Support

If you encounter any issues:
1. Check `database-setup\setup-log.txt`
2. Verify SQL Server is running
3. Ensure Windows Authentication is enabled
4. Run scripts as Administrator

**All automated. All complete. All ready!** 🚀

