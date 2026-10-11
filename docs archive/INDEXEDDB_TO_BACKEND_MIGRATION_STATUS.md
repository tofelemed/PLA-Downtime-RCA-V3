# IndexedDB to Backend API Migration Status

## ✅ Completed Migrations

### 1. **PlantSelectionContext** ✅
- **File**: `src/contexts/PlantSelectionContext.tsx`
- **Change**: Replaced `storageService.getAppSetting()` and `storageService.setAppSetting()` with `appSettingsApi.getValue()` and `appSettingsApi.setValue()`
- **Status**: Complete

### 2. **appSettingsApi** ✅
- **File**: `src/services/api/appSettingsApi.ts`
- **Change**: Fixed to use `httpClient.request()` instead of incorrect httpClient methods
- **Status**: Complete

### 3. **AuditService** ✅
- **File**: `src/services/AuditService.ts`
- **Change**: Replaced `storageService.create()` with `auditApi.createLog()`
- **Note**: Backend needs GET endpoint for querying audit logs
- **Status**: Complete (logging only)

---

## 🔄 In Progress

### 4. **MasterDataService** - 111+ StorageService Calls ⚠️
- **File**: `src/services/MasterDataService.ts`
- **Status**: Partially migrated - has API calls with IndexedDB fallbacks
- **Action Required**: Remove all fallback blocks (111+ instances)

**Pattern to Replace:**
```typescript
// BEFORE:
try {
  return await masterDataApi.createOrganization(apiPayload);
} catch (error) {
  console.warn('Falling back to IndexedDB for createOrganization', error);
  return await storageService.create<Organization>('organizations', payload);
}

// AFTER:
return await masterDataApi.createOrganization(apiPayload);
```

**Entities to Migrate in MasterDataService:**
- ✅ Organizations (has API, remove fallback)
- ✅ Tenants (has API, remove fallback)
- ✅ Units (has API, remove fallback)
- ✅ Assets (has API, remove fallback)
- ✅ ImpactCodes (has API, remove fallback)
- ✅ OEECodes (has API, remove fallback)
- ✅ RCACauseCodes (has API, remove fallback)
- ✅ VerificationStatusCodes (has API, remove fallback)
- ✅ EvidenceCategories (has API, remove fallback)
- ✅ EvidenceLocations (has API, remove fallback)
- ✅ Products (has API, remove fallback)
- ✅ RCATemplates (has API, remove fallback)
- ✅ ProductionPlans (has API via productionApi, remove fallback)
- ✅ ProductionPlanTemplates (has API via productionApi, remove fallback)
- ✅ ProductionEvents (has API via productionApi, remove fallback)
- ✅ ProductionLosses (has API via productionApi, remove fallback)
- ✅ OEESummaries (has API via productionApi, remove fallback)
- ✅ LossCategories (has API via productionApi, remove fallback)
- ✅ ReconcileForms (has API via productionApi, remove fallback)
- ✅ RCAs (has API via productionApi, remove fallback)
- ✅ ReasonCodes (has API, remove fallback)
- ⚠️ DashboardConfigurations (needs to use dashboardApi)
- ⚠️ Tasks (needs to use taskApi)
- ⚠️ AuditLogs (query methods - backend needs GET endpoint)
- ⚠️ UnmappedEvents (needs to use unmappedEventApi)

---

## 📋 Remaining Work

### High Priority Files (24 files using StorageService)

1. **src/services/MasterDataService.ts** - 111+ calls
2. **src/services/DataSourceService.ts** - Uses storageService for dataSources
3. **src/services/CustomAttributeService.ts** - Has fallbacks, remove them
4. **src/services/pi/PIStore.ts** - Uses storageService for PI data
5. **src/components/UserManagementPanel.tsx** - Use userApi
6. **src/pages/UserManagement.tsx** - Use userApi
7. **src/pages/RCAModule.tsx** - Check StorageService usage
8. **src/scripts/*.ts** - Seeding scripts (can keep IndexedDB for seeding only)
9. **src/services/*Seeder.ts** - Seeding services (can keep IndexedDB for seeding only)

### Migration Strategy

#### Option 1: Remove All Fallbacks (Recommended)
Remove all try-catch fallback blocks and use APIs directly. This forces backend integration.

#### Option 2: Hybrid Approach
Keep IndexedDB only for:
- Seeding scripts (temporary data)
- Offline caching (future enhancement)

---

## 🔧 Migration Pattern

For each service method:

1. **Identify the API service** - Check `src/services/api/` for matching API
2. **Remove try-catch fallback** - Delete IndexedDB fallback code
3. **Update error handling** - Let errors propagate or handle appropriately
4. **Test** - Verify API endpoints work

### Example Migration:

**Before:**
```typescript
async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
  try {
    return await masterDataApi.createOrganization(apiPayload);
  } catch (error) {
    console.warn('Falling back to IndexedDB', error);
    return await storageService.create<Organization>('organizations', payload);
  }
}
```

**After:**
```typescript
async createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
  const payload = { ...data, isActive: data.isActive ?? true };
  const { address, contactEmail, contactPhone, ...apiPayload } = payload;
  return await masterDataApi.createOrganization(apiPayload);
}
```

---

## 📊 Progress Summary

| Category | Total | Completed | Remaining | % Complete |
|----------|-------|-----------|-----------|------------|
| Contexts | 2 | 2 | 0 | 100% |
| API Services | 16 | 16 | 0 | 100% |
| Core Services | 5 | 2 | 3 | 40% |
| MasterDataService Methods | 50+ | 0 | 50+ | 0% |
| Components | 2 | 0 | 2 | 0% |
| **TOTAL** | **75+** | **20** | **55+** | **~27%** |

---

## 🚀 Next Steps

1. ✅ **Complete**: Contexts and API services
2. 🔄 **In Progress**: Remove fallbacks from MasterDataService
3. ⏳ **Next**: Update DataSourceService, CustomAttributeService, PIStore
4. ⏳ **Then**: Update User Management components
5. ⏳ **Finally**: Update scripts (or keep IndexedDB for seeding only)

---

## 📝 Notes

- All backend endpoints are tested and working (128/128 tests passing)
- API services already exist for all entities
- Main work is removing IndexedDB fallbacks
- Some seeding scripts may intentionally keep IndexedDB for local data seeding

---

*Last Updated: 2025-01-26*

