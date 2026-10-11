# 📊 Hierarchy Mapping Data Storage

## Answer: **BACKEND DATABASE (MS SQL Server)** ✅

The hierarchy mapping data is stored in the **backend database**, NOT in IndexedDB.

---

## Data Flow

```
Frontend UI
    ↓
HierarchyMappingService (Frontend)
    ↓
hierarchyMappingApi (API Client)
    ↓
HTTP Request to Backend
    ↓
HierarchyMappingController (Backend)
    ↓
HierarchyMappingService (Backend)
    ↓
TypeORM Repository
    ↓
MS SQL Server Database
    ↓
Table: source_hierarchy_mappings
```

---

## Storage Details

### **Backend Database (MS SQL Server)**
- **Table Name**: `source_hierarchy_mappings`
- **Database**: `ProActDB` (or your configured database name)
- **ORM**: TypeORM
- **Connection**: Configured in `.env` file

### **Database Schema**
The table was created using the migration script:
- `server/pro-act-backend/database-setup/create-source-hierarchy-mappings-table.sql`

### **Columns**
- `id` (UUID, Primary Key)
- `source_type` (VARCHAR)
- `source_identifier` (NVARCHAR)
- `source_path` (NVARCHAR, nullable)
- `target_type` (VARCHAR)
- `target_id` (UUID)
- `tenant_id` (VARCHAR)
- `organization_id` (VARCHAR, nullable)
- `is_pattern` (BIT)
- `pattern` (NVARCHAR, nullable)
- `priority` (INT)
- `is_active` (BIT)
- `description` (NVARCHAR(MAX), nullable)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

---

## Why Backend Database (Not IndexedDB)?

This follows the **migration strategy** from IndexedDB to backend APIs:

1. ✅ **Centralized Data**: All data stored in one place
2. ✅ **Multi-User Support**: Multiple users can access the same mappings
3. ✅ **Data Persistence**: Data survives browser clearing
4. ✅ **Backup & Recovery**: Database can be backed up
5. ✅ **Scalability**: Can handle large amounts of data
6. ✅ **Security**: Database-level access control
7. ✅ **Consistency**: Same data for all users

---

## How It Works

### **1. Creating a Mapping**

**Frontend:**
```typescript
await hierarchyMappingService.createMapping({
  sourceType: 'PI',
  sourceIdentifier: 'F1DPqQ_8kaqkDxyz',
  targetType: 'unit',
  targetId: 'unit-id-123',
  tenantId: 'tenant-id-456',
  // ... other fields
});
```

**Backend API Call:**
```
POST /api/hierarchy-mappings
```

**Database:**
- TypeORM creates new record
- Saves to `source_hierarchy_mappings` table
- Returns saved entity

---

### **2. Reading Mappings**

**Frontend:**
```typescript
const mappings = await hierarchyMappingService.getMappings(tenantId);
```

**Backend API Call:**
```
GET /api/hierarchy-mappings?tenantId=xxx
```

**Database:**
- TypeORM queries `source_hierarchy_mappings` table
- Filters by `tenantId`
- Returns array of mappings

---

### **3. Seeding Test Data**

**Frontend:**
```typescript
await hierarchyMappingSeeder.seedHierarchyMappings(tenantId);
```

**Process:**
1. Creates multiple mapping objects
2. Calls `hierarchyMappingService.createMapping()` for each
3. Each mapping is saved to the database via API
4. All data persists in SQL Server

---

## Verification

You can verify the data is in the database by:

### **Method 1: SQL Query**
```sql
USE ProActDB;
GO

SELECT * FROM source_hierarchy_mappings
WHERE tenant_id = 'your-tenant-id'
ORDER BY priority DESC;
```

### **Method 2: Backend Logs**
When you create a mapping, check backend logs:
```
[HierarchyMappingService] Creating mapping...
[TypeORM] INSERT INTO source_hierarchy_mappings ...
```

### **Method 3: API Response**
Check the API response when fetching mappings:
- Open browser DevTools (F12)
- Go to Network tab
- Filter by "hierarchy-mappings"
- View the response - data comes from database

---

## Important Notes

### ✅ **Data Persistence**
- Data is **permanently stored** in SQL Server
- Survives browser restarts
- Survives clearing browser cache
- Shared across all users with same tenant

### ✅ **Database Required**
- Backend must be connected to SQL Server
- Database must have the `source_hierarchy_mappings` table
- Migration script must be run first

### ✅ **Tenant Isolation**
- All mappings are filtered by `tenantId`
- Each tenant sees only their own mappings
- Multi-tenant architecture supported

---

## Migration from IndexedDB

This module was designed from the start to use **backend database**, following the migration pattern:

**Old Pattern (IndexedDB):**
```
Frontend → IndexedDB (Browser)
```

**New Pattern (Backend API):**
```
Frontend → HTTP API → Backend → SQL Server
```

This ensures:
- ✅ Data is centralized
- ✅ Consistent across all clients
- ✅ Can be backed up
- ✅ Multi-user support

---

## Summary

| Aspect | Storage Location |
|--------|-----------------|
| **Hierarchy Mappings** | ✅ Backend Database (SQL Server) |
| **Table Name** | `source_hierarchy_mappings` |
| **ORM** | TypeORM |
| **IndexedDB** | ❌ Not used for hierarchy mappings |

**All hierarchy mapping data is stored in your MS SQL Server database!** 🎯

