# 🔧 PI Connection & Sync Jobs Fixes

## ✅ Issues Fixed

### **1. PI Connection 400 Bad Request**

**Problem:**
```
GET http://localhost:8070/piwebapi/assetservers 400 (Bad Request)
```

**Root Cause:**
- `PIClient` was using relative path `/piwebapi` instead of full URL from form
- Requests were going to `localhost:8070` instead of actual PI server

**Fix Applied:**
- ✅ Updated `PIClient` to accept `baseUrl` option (full URL)
- ✅ Updated `PIIntegration.tsx` to pass `baseUrl` from form to `PIClient`

**Files Changed:**
- `src/services/pi/PIClient.ts` - Added `baseUrl` option support
- `src/pages/integrations/PIIntegration.tsx` - Use `baseUrl` instead of `basePath`

---

### **2. PI Sync Jobs NULL ID Error**

**Problem:**
```
Cannot insert the value NULL into column 'id', table 'ProActDB.dbo.pi_sync_jobs'; 
column does not allow nulls. INSERT fails.
```

**Root Cause:**
- Database table `pi_sync_jobs.id` column doesn't have `DEFAULT NEWID()` constraint
- TypeORM's `@PrimaryGeneratedColumn('uuid')` doesn't work with SQL Server VARCHAR columns without default

**Fix Applied:**
1. ✅ **Service Fix**: Updated `PISyncJobService` to manually generate UUID using `randomUUID()` (like other services)
2. ✅ **Database Fix**: Created migration script to add `DEFAULT NEWID()` constraint

**Files Changed:**
- `server/pro-act-backend/src/pi-sync-job/pi-sync-job.service.ts` - Generate UUID manually
- `server/pro-act-backend/database-setup/fix-pi-sync-jobs-id-default.sql` - Migration script
- `server/pro-act-backend/database-setup/run-fix-pi-sync-jobs.ps1` - PowerShell runner

---

## 📋 **Next Steps**

### **1. Fix PI Connection Base URL**

The fix is already applied in code. **No action needed** - just make sure the baseUrl in the form is correct:
```
https://piv.hillal-intl.com:8070/piwebapi
```
(or your actual PI server URL)

### **2. Fix PI Sync Jobs ID**

**Run the database migration:**

```powershell
cd server/pro-act-backend/database-setup
.\run-fix-pi-sync-jobs.ps1
```

Or manually:
```sql
ALTER TABLE [dbo].[pi_sync_jobs]
ADD CONSTRAINT [DF_pi_sync_jobs_id] DEFAULT (NEWID()) FOR [id];
```

**Then restart the backend server.**

---

## ✅ **Status**

- ✅ **PI Connection Fix**: Code updated - ready to test
- ✅ **PI Sync Jobs Fix**: Service updated - migration script ready to run

---

**After running the migration, the NULL ID error will be resolved!** 🎉

