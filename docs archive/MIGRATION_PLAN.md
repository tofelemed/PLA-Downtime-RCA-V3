# IndexedDB to Backend API Migration Plan

## Strategy

Replace `storageService` usage with backend API calls. All backend endpoints are tested and ready.

## Migration Steps

1. ✅ Update `PlantSelectionContext` - Use appSettingsApi instead of StorageService
2. ✅ Update `MasterDataService` - Replace StorageService calls with API calls  
3. ✅ Update `CustomAttributeService` - Already partially migrated, complete it
4. ✅ Update `DataSourceService` - Replace IndexedDB with dataSourceApi
5. ✅ Update `PIStore` - Replace with piIntegrationApi
6. ✅ Update `AuditService` - Replace with auditApi
7. ✅ Update User Management components - Use userApi
8. ✅ Update RCA services - Use rcaAnalysisApi, productionApi

## File-by-File Changes

### High Priority (Used Most Frequently)
- `src/contexts/PlantSelectionContext.tsx` → Use appSettingsApi
- `src/services/MasterDataService.ts` → Replace StorageService with masterDataApi, productionApi
- `src/contexts/AuthContext.tsx` → Already using APIs ✅

### Medium Priority
- `src/services/CustomAttributeService.ts` → Already has fallback, remove IndexedDB
- `src/services/DataSourceService.ts` → Use dataSourceApi  
- `src/services/AuditService.ts` → Use auditApi
- `src/components/UserManagementPanel.tsx` → Use userApi
- `src/pages/UserManagement.tsx` → Use userApi

### Lower Priority (Scripts/Utilities)
- `src/services/pi/PIStore.ts` → Use piIntegrationApi
- `src/scripts/*` → Update seeding scripts to use APIs
- `src/services/*Seeder.ts` → Update to use APIs

