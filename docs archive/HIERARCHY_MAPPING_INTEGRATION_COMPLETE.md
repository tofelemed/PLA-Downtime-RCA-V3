# ✅ Hierarchy Mapping Integration - COMPLETE!

## 📋 Summary

The Universal Hierarchy Mapping System has been fully integrated into both backend and frontend. All TypeScript errors have been fixed, and the system is ready for testing.

---

## 🗄️ Database Migration

### **Migration Script Location**
- **Script**: `server/pro-act-backend/database-setup/create-source-hierarchy-mappings-table.sql`
- **Runner**: `server/pro-act-backend/database-setup/run-hierarchy-mapping-migration.ps1`

### **How to Run Migration**

#### Option 1: Using PowerShell Script (Recommended)
```powershell
cd server/pro-act-backend/database-setup
.\run-hierarchy-mapping-migration.ps1
```

#### Option 2: Using SQL Server Management Studio (SSMS)
1. Open SQL Server Management Studio
2. Connect to your SQL Server instance
3. Open the file: `server/pro-act-backend/database-setup/create-source-hierarchy-mappings-table.sql`
4. Ensure `ProActDB` database is selected
5. Execute the script (F5)

#### Option 3: Using sqlcmd (Command Line)
```bash
sqlcmd -S localhost -d ProActDB -E -i "server/pro-act-backend/database-setup/create-source-hierarchy-mappings-table.sql"
```

### **What the Migration Creates**
- Table: `source_hierarchy_mappings`
- 8 indexes for optimal query performance
- All necessary columns for universal mapping

---

## 🎯 Frontend Integration

### **Created Files**

1. **API Service** (`src/services/api/hierarchyMappingApi.ts`)
   - Direct API client for hierarchy mapping endpoints
   - Full TypeScript type definitions
   - All CRUD operations + find-mapping endpoint

2. **Service Wrapper** (`src/services/HierarchyMappingService.ts`)
   - High-level service interface
   - Singleton pattern
   - Helper methods for common operations
   - Error handling

### **Backend Endpoints**

All endpoints are available at `/api/hierarchy-mappings`:

- `POST /api/hierarchy-mappings` - Create mapping
- `GET /api/hierarchy-mappings?tenantId=xxx` - List mappings (with optional filters)
- `GET /api/hierarchy-mappings/:id` - Get single mapping
- `PUT /api/hierarchy-mappings/:id` - Update mapping
- `DELETE /api/hierarchy-mappings/:id` - Delete mapping
- `POST /api/hierarchy-mappings/find-mapping` - Find hierarchy for an event

---

## 📖 Usage Examples

### **1. Import the Service**

```typescript
import { hierarchyMappingService } from '@/services/HierarchyMappingService';
import { hierarchyMappingApi } from '@/services/api/hierarchyMappingApi';
```

### **2. Create a Direct Mapping**

```typescript
// Map a specific PI WebId to a Unit
const mapping = await hierarchyMappingService.createDirectMapping(
  tenantId,
  'PI',                    // sourceType
  'F1DPqQ_8kaqkDxyz',      // PI WebId
  'unit',                  // targetType
  'unit-uuid-here',        // Unit ID
  {
    description: 'PI Element to Unit mapping',
    priority: 75,
    sourceConnectionId: 'pi-connection-id',
  }
);
```

### **3. Create a Pattern-Based Mapping**

```typescript
// Map all PI elements matching a pattern to a Unit
const patternMapping = await hierarchyMappingService.createPatternMapping(
  tenantId,
  'PI',
  'PI\\\\Plant1\\\\Line1\\\\*',  // Pattern (double backslash for JSON)
  'unit',
  'unit-uuid-here',
  {
    priority: 60,
    description: 'All Line1 elements map to this unit',
  }
);
```

### **4. Find Hierarchy for an Event**

```typescript
// When pulling events from PI, find which unit/asset they belong to
const hierarchyIds = await hierarchyMappingService.findHierarchyForEvent({
  sourceType: 'PI',
  sourceIdentifier: 'F1DPqQ_8kaqkDxyz',  // PI WebId
  sourcePath: 'PI\\Plant1\\Line1\\Pump1',
  connectionId: 'pi-connection-id',
  tenantId: tenantId,
});

if (hierarchyIds) {
  console.log('Unit ID:', hierarchyIds.unitId);
  console.log('Asset ID:', hierarchyIds.assetId);
}
```

### **5. List All Mappings**

```typescript
// Get all mappings for a tenant
const allMappings = await hierarchyMappingService.getMappings(tenantId);

// Filter by source type
const piMappings = await hierarchyMappingService.getMappingsBySourceType(tenantId, 'PI');

// Get only active mappings
const activeMappings = await hierarchyMappingService.getActiveMappings(tenantId);
```

### **6. Update a Mapping**

```typescript
// Update mapping priority
await hierarchyMappingService.updatePriority(mappingId, 80);

// Toggle active status
await hierarchyMappingService.toggleMapping(mappingId, false);

// Full update
await hierarchyMappingService.updateMapping(mappingId, {
  description: 'Updated description',
  priority: 85,
  isActive: true,
});
```

### **7. Delete a Mapping**

```typescript
await hierarchyMappingService.deleteMapping(mappingId);
```

---

## 🧪 Testing Event Ingestion with Mapping

### **Step 1: Create Mappings**

Before pulling events, set up mappings:

```typescript
// Example: Map PI elements to your hierarchy
const mappings = [
  {
    sourceType: 'PI' as const,
    sourceIdentifier: 'PI\\Plant1\\Line1\\Pump1',
    targetType: 'asset' as const,
    targetId: assetId1,
    tenantId: tenantId,
    isPattern: false,
    priority: 70,
  },
  {
    sourceType: 'PI' as const,
    pattern: 'PI\\\\Plant1\\\\Line1\\\\*',
    targetType: 'unit' as const,
    targetId: unitId1,
    tenantId: tenantId,
    isPattern: true,
    priority: 50,
  },
];

for (const mapping of mappings) {
  await hierarchyMappingService.createMapping(mapping);
}
```

### **Step 2: Pull Events**

Use the unified event pull service:

```typescript
import { connectivityApi } from '@/services/api/connectivityApi';

const response = await connectivityApi.pullEvents({
  sourceType: 'PI',
  sourceId: 'pi-connection-id',
  tenantId: tenantId,
  startTimeUtc: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
  endTimeUtc: new Date().toISOString(),
  maxCount: 100,
  autoCreateProductionEvents: true, // This will use hierarchy mappings automatically
});
```

### **Step 3: Verify Events are Tagged**

The backend will automatically:
1. Pull events from PI
2. Use `HierarchyMappingService.findHierarchyMapping()` to find the hierarchy
3. Tag production events with `unitId` and `assetId`
4. Create production events in the database

Check the created production events:

```typescript
import { productionApi } from '@/services/api/productionApi';

const events = await productionApi.list({ tenantId });
events.forEach(event => {
  console.log(`Event ${event.id}: Unit=${event.unitId}, Asset=${event.assetId}`);
});
```

---

## 🔗 Integration Points

### **Backend Integration**

The hierarchy mapping is already integrated into:

1. **`PIEventPullService`** (`server/pro-act-backend/src/integration/pi-event-pull.service.ts`)
   - Automatically uses hierarchy mapping when creating production events
   - Falls back to old `AfBinding` system if mapping not found

2. **`UnifiedEventPullService`** (`server/pro-act-backend/src/connectivity/services/unified-event-pull.service.ts`)
   - Uses hierarchy mapping for all source types (PI, OPCUA, Modbus, MQTT, etc.)

### **Frontend Integration Points**

You can integrate the service into:

1. **Connectivity/Integration Management Pages**
   - Create/edit mappings when configuring connections
   - Show mapping status and statistics

2. **Event Pull/Import Pages**
   - Show which events will be mapped to which hierarchy
   - Allow bulk mapping creation

3. **Mapping Management UI** (to be created)
   - List all mappings
   - Create/edit/delete mappings
   - Test mappings

---

## 📝 Next Steps

1. ✅ **Run Database Migration**
   ```powershell
   cd server/pro-act-backend/database-setup
   .\run-hierarchy-mapping-migration.ps1
   ```

2. ✅ **Restart Backend Server**
   - The backend should automatically detect the new table

3. **Test API Endpoints**
   - Use Swagger UI at `http://localhost:3000/api`
   - Test CRUD operations
   - Test `find-mapping` endpoint

4. **Create UI Components** (Optional)
   - Mapping management page
   - Mapping creation form
   - Mapping list/table component

5. **Test Event Ingestion**
   - Create some test mappings
   - Pull events from a source
   - Verify events are tagged correctly

---

## 🐛 Troubleshooting

### **Migration Fails**
- Check SQL Server is running
- Verify database `ProActDB` exists
- Check connection credentials
- Review log file: `hierarchy-mapping-migration-log.txt`

### **API Returns 404**
- Verify backend is running
- Check endpoint path: `/api/hierarchy-mappings`
- Verify JWT token is valid

### **Mappings Not Working**
- Check mappings are active (`isActive: true`)
- Verify `tenantId` matches
- Check priority values (higher = checked first)
- Review backend logs for mapping lookup

### **Events Not Tagged**
- Verify mappings exist for the source
- Check source identifier matches exactly (case-sensitive)
- Verify pattern syntax if using pattern mappings
- Check backend logs in `PIEventPullService` or `UnifiedEventPullService`

---

## 📚 Additional Resources

- **Design Document**: `UNIVERSAL_HIERARCHY_MAPPING_SYSTEM.md`
- **Mismatch Solution**: `HIERARCHY_MISMATCH_MAPPING_SOLUTION.md`
- **Backend Controller**: `server/pro-act-backend/src/hierarchy-mapping/hierarchy-mapping.controller.ts`
- **Backend Service**: `server/pro-act-backend/src/hierarchy-mapping/hierarchy-mapping.service.ts`

---

## ✅ Status

- ✅ Backend entity created
- ✅ Backend service implemented
- ✅ Backend controller created
- ✅ Database migration script ready
- ✅ Frontend API service created
- ✅ Frontend service wrapper created
- ✅ TypeScript errors fixed
- ✅ Integrated into event pull services
- ⏳ Database migration (pending - run script)
- ⏳ UI components (optional)
- ⏳ Testing (pending - after migration)

---

**Ready to test!** Run the migration script and start creating mappings! 🚀

