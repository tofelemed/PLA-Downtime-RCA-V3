# Frontend IndexedDB to Backend API Comparison

This document compares the frontend IndexedDB implementation with the backend API to ensure all functionality is covered.

## Status: ✅ All Frontend Stores Have Backend Coverage

### Core Entities

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `users` | `UsersModule` | `/users` | ✅ Complete |
| `organizations` | `OrganizationModule` | `/organizations` | ✅ Complete |
| `tenants` | `TenantModule` | `/tenants` | ✅ Complete |
| `units` | `UnitModule` | `/units` | ✅ Complete |
| `assets` | `AssetModule` | `/assets` | ✅ Complete |
| `auditLogs` | `AuditLogModule` | `/audit-logs` | ✅ Complete |

### Code Management

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `impactCodes` | `ImpactCodeModule` | `/impact-codes` | ✅ Complete |
| `oeeCodes` | `OEECodeModule` | `/oee-codes` | ✅ Complete |
| `rcaCauseCodes` | `RCACauseCodeModule` | `/rca-cause-codes` | ✅ Complete |
| `verificationStatusCodes` | `VerificationStatusCodeModule` | `/verification-status-codes` | ✅ Complete |
| `reasonCodes` | `ReasonCodeModule` | `/reason-codes` | ✅ Complete |

### Production Management

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `products` | `ProductModule` | `/products` | ✅ Complete |
| `productionPlans` | `ProductionPlanModule` | `/production-plans` | ✅ Complete |
| `productionPlanTemplates` | `ProductionPlanTemplateModule` | `/production-plan-templates` | ✅ Complete |
| `productionEvents` | `ProductionEventModule` | `/production-events` | ✅ Complete |
| `productionLosses` | `ProductionLossModule` | `/production-losses` | ✅ Complete |
| `oeeSummaries` | `OEESummaryModule` | `/oee-summaries` | ✅ Complete |
| `reconcileForms` | `ReconcileFormModule` | `/reconcile-forms` | ✅ Complete |
| `lossCategories` | `LossCategoryModule` | `/loss-categories` | ✅ Complete |
| `unmappedEvents` | `UnmappedEventModule` | `/unmapped-events` | ✅ Complete |

### RCA (Root Cause Analysis)

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `rcas` | `RCAModule` | `/rcas` | ✅ Complete |
| `rcaRecommendations` | `RCARecommendationModule` | `/rca-recommendations` | ✅ Complete |
| `rcaEvidence` | `RCAEvidenceModule` | `/rca-evidence` | ✅ Complete |
| `logicTreeNodes` | `LogicTreeNodeModule` | `/logic-tree-nodes` | ✅ Complete |
| `rcaTriggerConfigs` | `RCATriggerConfigModule` | `/rca-trigger-configs` | ✅ Complete |
| `rcaKnowledgeBase` | `RCAKnowledgeBaseModule` | `/rca-knowledge-base` | ✅ Complete |
| `rcaAnalysisConfigs` | `RCAAnalysisConfigModule` | `/rca-analysis-configs` | ✅ Complete |
| `rcaTemplates` | `RCATemplateModule` | `/rca-templates` | ✅ Complete |

### RCA Analysis Methodologies

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `fiveWhyAnalyses` | `FiveWhyAnalysisModule` + `RCAAnalysisMethodologyModule` | `/five-why-analyses` + `/rca-analysis/five-why` | ✅ Complete |
| `fishboneDiagrams` | `FishboneDiagramModule` + `RCAAnalysisMethodologyModule` | `/fishbone-diagrams` + `/rca-analysis/fishbone` | ✅ Complete |
| `fmeaAnalyses` | `FMEAAnalysisModule` + `RCAAnalysisMethodologyModule` | `/fmea-analyses` + `/rca-analysis/fmea` | ✅ Complete |
| `faultTreeAnalyses` | `FaultTreeAnalysisModule` + `RCAAnalysisMethodologyModule` | `/fault-tree-analyses` + `/rca-analysis/fault-tree` | ✅ Complete |
| `barrierAnalyses` | `BarrierAnalysisModule` + `RCAAnalysisMethodologyModule` | `/barrier-analyses` + `/rca-analysis/barrier` | ✅ Complete |
| `changeAnalyses` | `ChangeAnalysisModule` + `RCAAnalysisMethodologyModule` | `/change-analyses` + `/rca-analysis/change` | ✅ Complete |

### Evidence Management

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `evidenceCategories` | `EvidenceCategoryModule` | `/evidence-categories` | ✅ Complete |
| `evidenceLocations` | `EvidenceLocationModule` | `/evidence-locations` | ✅ Complete |

### PI Integration

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `piConnections` | `PIConnectionModule` | `/pi-connections` | ✅ Complete |
| `piAfElements` | `PIAfElementModule` | `/pi-af-elements` | ✅ Complete |
| `afBindings` | `AfBindingModule` | `/af-bindings` | ✅ Complete |
| `piEvents` | `PIEventModule` | `/pi-events` | ✅ Complete |
| `piMappings` | `PIMappingModule` | `/pi-mappings` | ✅ Complete |
| `piSyncWatermarks` | `PISyncWatermarkModule` | `/pi-sync-watermarks` | ✅ Complete |
| `piSyncJobs` | `PISyncJobModule` | `/pi-sync-jobs` | ✅ Complete |
| `historianTags` | `HistorianTagModule` | `/historian-tags` | ✅ Complete |

### Custom Attributes & Configuration

| Frontend Store | Backend Module | Backend Controller | Status |
|---------------|----------------|-------------------|--------|
| `customAttributeDefinitions` | `CustomAttributeDefinitionModule` | `/custom-attribute-definitions` | ✅ Complete |
| `customAttributeValues` | `CustomAttributeValueModule` | `/custom-attribute-values` | ✅ Complete |
| `dataSources` | `DataSourceModule` | `/data-sources` | ✅ Complete |
| `appSettings` | `AppSettingsModule` | `/app-settings` | ✅ Complete |
| `dashboardConfigurations` | `DashboardConfigurationModule` | `/dashboard-configurations` | ✅ Complete |

### Additional Services

| Frontend Service | Backend Module | Backend Controller | Status |
|-----------------|----------------|-------------------|--------|
| `HistorianHistoryDB` (queryHistory) | `HistorianHistoryModule` | `/historian-history` | ✅ Complete |
| `ProfinetStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `EtherNetIPStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `PerformanceStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `QualityStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `AnalyticsStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `CorrelationStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `AlertStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |
| `FilterStorageService` | N/A (Frontend-only for now) | N/A | ⚠️ Frontend-only |

## Summary

### ✅ Complete Coverage (48 stores)
All main IndexedDB stores from `StorageService` have corresponding backend modules and controllers.

### ⚠️ Frontend-Only Services (8 services)
These services use separate IndexedDB databases and are currently frontend-only:
- ProfinetStorageService
- EtherNetIPStorageService
- PerformanceStorageService
- QualityStorageService
- AnalyticsStorageService
- CorrelationStorageService
- AlertStorageService
- FilterStorageService

These are likely monitoring/analytics services that may not need backend persistence, or are planned for future backend integration.

## Backend API Operations

All backend modules provide standard CRUD operations:
- `GET /{resource}` - List all (with optional filters)
- `GET /{resource}/:id` - Get by ID
- `POST /{resource}` - Create
- `PUT /{resource}/:id` - Update
- `DELETE /{resource}/:id` - Delete

Additional operations available:
- Real-time updates via WebSocket (`RealtimeGateway`)
- Filtering by `tenantId`, `organizationId`, and other relevant fields
- Audit logging for all operations

## Recommendations

1. ✅ **All core functionality is covered** - The backend has complete API coverage for all frontend IndexedDB stores.

2. ⚠️ **Consider backend integration for monitoring services** - If the frontend-only services (Profinet, EtherNetIP, Performance, Quality, Analytics, Correlation, Alert, Filter) need to persist data across sessions or share data between users, consider creating backend modules for them.

3. ✅ **TypeScript errors fixed** - All compilation errors have been resolved.

4. ✅ **API consistency** - All modules follow the same CRUD pattern, making integration straightforward.

## Next Steps

1. Test backend API endpoints to ensure they match frontend expectations
2. Verify data structure compatibility between frontend interfaces and backend entities
3. Consider adding backend support for monitoring/analytics services if needed
4. Implement API client in frontend to replace IndexedDB calls with API calls

