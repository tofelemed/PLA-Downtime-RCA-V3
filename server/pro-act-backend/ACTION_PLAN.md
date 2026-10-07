# ProAct Backend - Action Plan for Completion

## 🎯 Mission
Complete the ProAct backend to match 100% of STORAGE_SERVICE_BACKEND_REFERENCE.md specification.

---

## ✅ What You Have Now

### Completed Modules (4)
1. ✅ `rca-trigger-config` - RCA trigger configuration
2. ✅ `rca-knowledge-base` - Knowledge base articles  
3. ✅ `rca-analysis-config` - Analysis configurations
4. ✅ `five-why-analysis` - Five Why analysis tool

### Complete Documentation (6 files)
1. ✅ `COMPLETE_IMPLEMENTATION_GUIDE.md` - **Your main reference**
2. ✅ `API_IMPLEMENTATION_GUIDE.md` - Complete API docs
3. ✅ `IMPLEMENTATION_PROGRESS.md` - Status tracking
4. ✅ `BACKEND_COMPLETION_SUMMARY.md` - Executive summary
5. ✅ `IMPLEMENTATION_README.md` - Quick start guide
6. ✅ `ACTION_PLAN.md` - This file

### Working Backend Foundation
- ✅ 33 existing modules fully functional
- ✅ Authentication system (JWT)
- ✅ Multi-tenancy support
- ✅ TypeORM integration
- ✅ Swagger documentation
- ✅ Validation pipes
- ✅ Error handling
- ✅ 165+ API endpoints working

---

## 📋 Step-by-Step Completion Plan

### Phase 1: Analysis Tools (60 minutes)

**Task 1.1: Fishbone Diagram Module** (12 min)
```bash
# 1. Create directory
mkdir src/fishbone-diagram
mkdir src/fishbone-diagram/dto

# 2. Copy template from five-why-analysis
# 3. Update entity fields:
#    - problemStatement (text)
#    - categories (JSON)
#    - causes (JSON)
# 4. Update table name: fishbone_diagrams
# 5. Update API route: /fishbone-diagrams
```

**Task 1.2: FMEA Analysis Module** (12 min)
```bash
mkdir src/fmea-analysis
mkdir src/fmea-analysis/dto

# Update entity fields:
#   - analysisName (string)
#   - failureModes (JSON)
# Table: fmea_analyses
# Route: /fmea-analyses
```

**Task 1.3: Fault Tree Analysis Module** (12 min)
```bash
mkdir src/fault-tree-analysis
mkdir src/fault-tree-analysis/dto

# Update entity fields:
#   - topEvent (text)
#   - treeData (JSON)
# Table: fault_tree_analyses  
# Route: /fault-tree-analyses
```

**Task 1.4: Barrier Analysis Module** (12 min)
```bash
mkdir src/barrier-analysis
mkdir src/barrier-analysis/dto

# Update entity fields:
#   - hazard (text)
#   - barriers (JSON)
# Table: barrier_analyses
# Route: /barrier-analyses
```

**Task 1.5: Change Analysis Module** (12 min)
```bash
mkdir src/change-analysis
mkdir src/change-analysis/dto

# Update entity fields:
#   - changeDescription (text)
#   - changes (JSON)
# Table: change_analyses
# Route: /change-analyses
```

✅ **Checkpoint**: 5 analysis modules created, test via Swagger

---

### Phase 2: PI Integration (80 minutes)

**Task 2.1: PI Connection Module** (10 min)
```bash
mkdir src/pi-connection
mkdir src/pi-connection/dto

# Fields: connectionName, piWebApiUrl, username, 
#         passwordEncrypted, afDatabasePath, isActive, lastSyncTime
# Table: pi_connections
# Route: /pi-connections
```

**Task 2.2: PI AF Element Module** (10 min)
```bash
mkdir src/pi-af-element
mkdir src/pi-af-element/dto

# Fields: webId (UNIQUE), name, description, path, 
#         template, parentId, hasChildren
# Indexes: parentId, template, webId
# Table: pi_af_elements
# Route: /pi-af-elements
# Filters: parentId, template
```

**Task 2.3: AF Binding Module** (10 min)
```bash
mkdir src/af-binding
mkdir src/af-binding/dto

# Fields: webId, localId, boundType, mappingConfig (JSON), isActive
# Indexes: webId, boundType, localId
# Table: af_bindings
# Route: /af-bindings
# Filters: boundType, localId
```

**Task 2.4: PI Event Module** (10 min)
```bash
mkdir src/pi-event
mkdir src/pi-event/dto

# Fields: webId, name, template, primaryAfId, startUtc, 
#         endUtc, acknowledged, eventData (JSON)
# Indexes: template, primaryAfId, startUtc
# Table: pi_events
# Route: /pi-events
# Filters: template, primaryAfId, startUtc
```

**Task 2.5: PI Mapping Module** (8 min)
```bash
mkdir src/pi-mapping
mkdir src/pi-mapping/dto

# Fields: sourceType, sourceId, targetType, targetId, 
#         mappingRules (JSON), isActive
# Table: pi_mappings
# Route: /pi-mappings
# Filters: sourceType, targetType
```

**Task 2.6: PI Sync Watermark Module** (8 min)
```bash
mkdir src/pi-sync-watermark
mkdir src/pi-sync-watermark/dto

# Fields: syncType, lastSyncTimestamp, lastSyncMarker, syncStatus
# Table: pi_sync_watermarks
# Route: /pi-sync-watermarks
# Filters: syncType
```

**Task 2.7: PI Sync Job Module** (10 min)
```bash
mkdir src/pi-sync-job
mkdir src/pi-sync-job/dto

# Fields: jobName, jobType, schedule, lastRunTime, nextRunTime,
#         status, errorMessage, jobConfig (JSON), isActive
# Table: pi_sync_jobs
# Route: /pi-sync-jobs
# Filters: status
```

**Task 2.8: Historian Tag Module** (10 min)
```bash
mkdir src/historian-tag
mkdir src/historian-tag/dto

# Fields: webId, tagName, description, category, 
#         unitOfMeasure, dataType, enabled
# Indexes: webId, category, enabled
# Table: historian_tags
# Route: /historian-tags
# Filters: category, enabled
```

✅ **Checkpoint**: 8 PI integration modules created

---

### Phase 3: Final Modules (50 minutes)

**Task 3.1: Data Source Module** (15 min)
```bash
mkdir src/data-source
mkdir src/data-source/dto

# Fields: sourceName, type, connectionString, credentialsEncrypted,
#         status, enabled, lastSyncTime, config (JSON)
# Indexes: type, status, enabled
# Table: data_sources
# Route: /data-sources
# Filters: type, status, enabled
```

**Task 3.2: Custom Attribute Definition Module** (15 min)
```bash
mkdir src/custom-attribute-definition
mkdir src/custom-attribute-definition/dto

# Fields: entityType, attributeName, displayName, description,
#         dataType, isRequired, defaultValue, validationRules (JSON),
#         displayOrder, isActive
# Indexes: entityType
# Table: custom_attribute_definitions
# Route: /custom-attribute-definitions
# Filters: entityType
```

**Task 3.3: Custom Attribute Value Module** (15 min)
```bash
mkdir src/custom-attribute-value
mkdir src/custom-attribute-value/dto

# Fields: entityId, entityType, attributeDefinitionId, value
# Indexes: entityId, entityType, attributeDefinitionId
# Table: custom_attribute_values
# Route: /custom-attribute-values
# Filters: entityId, entityType, attributeDefinitionId
# Foreign Key: attributeDefinitionId → custom_attribute_definitions(id)
```

✅ **Checkpoint**: All standard modules created

---

### Phase 4: Historian History API (30 minutes)

**Task 4.1: Create Historian History Module** (30 min)

This is a special module with 8 methods. See COMPLETE_IMPLEMENTATION_GUIDE.md section "Historian History API" for full implementation.

```bash
mkdir src/historian-history
mkdir src/historian-history/dto

# Create these files:
# - historian-history.entity.ts (query_history table)
# - historian-history.service.ts (8 methods)
# - historian-history.controller.ts (8 endpoints)
# - historian-history.module.ts
# - dto/create-query-history.dto.ts
# - dto/update-query-history.dto.ts
```

**8 Methods to Implement**:
1. `saveQueryHistory(tenantId, history)` - PUT /api/historian/history/:tenantId
2. `loadQueryHistory(tenantId)` - GET /api/historian/history/:tenantId
3. `addQueryHistoryEntry(tenantId, entry)` - POST /api/historian/history/:tenantId
4. `removeQueryHistoryEntry(id)` - DELETE /api/historian/history/entry/:id
5. `clearQueryHistory(tenantId)` - DELETE /api/historian/history/:tenantId
6. `exportQueryHistory(tenantId)` - GET /api/historian/history/:tenantId/export
7. `importQueryHistory(tenantId, data)` - POST /api/historian/history/:tenantId/import
8. `forceDatabaseRecreation()` - POST /api/historian/history/recreate

✅ **Checkpoint**: Historian History API complete

---

### Phase 5: Configuration & Testing (30 minutes)

**Task 5.1: Update app.module.ts** (10 min)

Add all 17 new modules to imports array:

```typescript
import { FishboneDiagramModule } from './fishbone-diagram/fishbone-diagram.module';
import { FMEAAnalysisModule } from './fmea-analysis/fmea-analysis.module';
import { FaultTreeAnalysisModule } from './fault-tree-analysis/fault-tree-analysis.module';
import { BarrierAnalysisModule } from './barrier-analysis/barrier-analysis.module';
import { ChangeAnalysisModule } from './change-analysis/change-analysis.module';
import { PIConnectionModule } from './pi-connection/pi-connection.module';
import { PIAfElementModule } from './pi-af-element/pi-af-element.module';
import { AfBindingModule } from './af-binding/af-binding.module';
import { PIEventModule } from './pi-event/pi-event.module';
import { PIMappingModule } from './pi-mapping/pi-mapping.module';
import { PISyncWatermarkModule } from './pi-sync-watermark/pi-sync-watermark.module';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { HistorianTagModule } from './historian-tag/historian-tag.module';
import { DataSourceModule } from './data-source/data-source.module';
import { CustomAttributeDefinitionModule } from './custom-attribute-definition/custom-attribute-definition.module';
import { CustomAttributeValueModule } from './custom-attribute-value/custom-attribute-value.module';
import { HistorianHistoryModule } from './historian-history/historian-history.module';

@Module({
  imports: [
    // ... existing modules ...
    FishboneDiagramModule,
    FMEAAnalysisModule,
    FaultTreeAnalysisModule,
    BarrierAnalysisModule,
    ChangeAnalysisModule,
    PIConnectionModule,
    PIAfElementModule,
    AfBindingModule,
    PIEventModule,
    PIMappingModule,
    PISyncWatermarkModule,
    PISyncJobModule,
    HistorianTagModule,
    DataSourceModule,
    CustomAttributeDefinitionModule,
    CustomAttributeValueModule,
    HistorianHistoryModule,
  ],
})
```

**Task 5.2: Create .env File** (5 min)

Use template from COMPLETE_IMPLEMENTATION_GUIDE.md, section "Environment Configuration"

**Task 5.3: Test All Endpoints** (15 min)

```bash
# Start server
npm run start:dev

# Open Swagger
http://localhost:3000/api

# Test each new module:
# 1. Create an entity
# 2. Get all entities
# 3. Get single entity
# 4. Update entity
# 5. Delete entity
```

✅ **Checkpoint**: All modules working

---

## 📊 Progress Tracking

Use this checklist as you work:

### Analysis Tools
- [ ] Fishbone Diagram Module
- [ ] FMEA Analysis Module
- [ ] Fault Tree Analysis Module
- [ ] Barrier Analysis Module
- [ ] Change Analysis Module

### PI Integration
- [ ] PI Connection Module
- [ ] PI AF Element Module
- [ ] AF Binding Module
- [ ] PI Event Module
- [ ] PI Mapping Module
- [ ] PI Sync Watermark Module
- [ ] PI Sync Job Module
- [ ] Historian Tag Module

### Integration & Custom
- [ ] Data Source Module
- [ ] Custom Attribute Definition Module
- [ ] Custom Attribute Value Module

### Special
- [ ] Historian History Module

### Configuration
- [ ] Updated app.module.ts
- [ ] Created .env file
- [ ] Tested all endpoints
- [ ] All compilation errors fixed

---

## 🎓 Tips for Each Phase

### While Creating Modules

1. **Use Template**: Copy from five-why-analysis or rca-trigger-config
2. **Find & Replace**: Update class names, table names, routes
3. **Update Fields**: Change entity properties per spec
4. **Check Indexes**: Add indexes as documented
5. **Test Immediately**: Restart server, check Swagger
6. **Fix Errors**: Address compilation issues before continuing

### Common Patterns

**Standard Entity**:
- Base fields (id, createdAt, updatedAt, tenantId, organizationId)
- Standard indexes (tenantId, organizationId, createdAt)
- CRUD service methods
- RESTful controller
- Validation in DTOs

**With Foreign Key**:
```typescript
@Column({ name: 'rca_id', type: 'varchar', length: 36 })
rcaId: string;

// Add to indexes
@Index(['rcaId'])
```

**With JSON Field**:
```typescript
@Column({ type: 'nvarchar', length: 'MAX', nullable: true })
fieldName?: string; // Store JSON as string
```

**With Unique Constraint**:
```typescript
@Column({ name: 'web_id', type: 'varchar', length: 255, unique: true })
webId: string;
```

---

## 💡 Efficiency Tips

1. **Batch Similar Modules**: Do all analysis tools together
2. **Keep Terminal Open**: Watch for compilation errors
3. **Use Copy-Paste**: Templates are designed for reuse
4. **Test in Swagger**: Fastest way to verify endpoints
5. **Commit Often**: After each module or phase
6. **Follow Order**: Analysis → PI → Custom → Historian
7. **Take Breaks**: 5 min break after each phase

---

## 🚀 Expected Timeline

| Phase | Duration | What You'll Accomplish |
|-------|----------|------------------------|
| Phase 1 | 60 min | 5 analysis tool modules |
| Phase 2 | 80 min | 8 PI integration modules |
| Phase 3 | 50 min | 3 final modules |
| Phase 4 | 30 min | Historian History API |
| Phase 5 | 30 min | Config & testing |
| **Total** | **4 hours** | **100% completion** |

---

## ✅ Success Criteria

You're done when:
- [ ] All 17 new modules created (102 files total)
- [ ] app.module.ts includes all modules
- [ ] Server starts without errors
- [ ] Swagger shows 250+ endpoints
- [ ] All CRUD operations work for new modules
- [ ] Filters work correctly
- [ ] No TypeScript compilation errors
- [ ] Database tables created via TypeORM

---

## 📞 Resources

| Need | See |
|------|-----|
| Module templates | COMPLETE_IMPLEMENTATION_GUIDE.md |
| Field definitions | STORAGE_SERVICE_BACKEND_REFERENCE.md |
| API examples | API_IMPLEMENTATION_GUIDE.md |
| Current status | IMPLEMENTATION_PROGRESS.md |
| Quick start | IMPLEMENTATION_README.md |

---

## 🎯 Final Notes

**You are 67% complete!**

Everything needed is in COMPLETE_IMPLEMENTATION_GUIDE.md:
- ✅ Exact templates for all modules
- ✅ All field specifications
- ✅ Index requirements
- ✅ Validation rules
- ✅ API route patterns

**Just follow the templates and you'll succeed!**

Good luck! 🚀

---

**Estimated Completion Time**: 3-4 hours
**Files to Create**: 102 files (17 modules × 6 files each)
**Endpoints to Add**: 85 new endpoints
**Result**: Production-ready backend matching 100% of specification

START WITH: **Phase 1, Task 1.1** (Fishbone Diagram Module)

GO! 💪

