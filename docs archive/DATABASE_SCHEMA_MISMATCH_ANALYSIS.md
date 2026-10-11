# 🚨 Critical Database Schema Mismatch Analysis

## Problem Statement

The frontend **REQUIRES** many fields that **DO NOT EXIST** in the database schema. This will cause:

1. ❌ **Data Loss**: Fields sent from frontend will be ignored when saving to database
2. ❌ **Runtime Errors**: Frontend will receive `undefined` values for required fields
3. ❌ **Broken Functionality**: Features that depend on these fields will fail

---

## Frontend Requirements vs Database Reality

### 1. Production Events

**Frontend Requires (from `MasterDataService.ts`):**
- ✅ `id`, `tenantId`, `organizationId`, `unitId`, `createdAt`, `updatedAt` - **EXISTS**
- ✅ `description`, `startTime`, `endTime`, `status`, `severity`, `eventType` - **EXISTS**
- ❌ `eventId` - **MISSING** (DB has `event_name` but not `eventId`)
- ❌ `planId`, `assetId`, `impactCodeId`, `oeeCodeId`, `rcaId` - **MISSING** (No FK columns)
- ❌ `source`, `quantity`, `cost` - **MISSING**
- ❌ `parameter`, `value`, `limit`, `limitType`, `breachDuration` - **MISSING** (IOW fields)
- ❌ `solType`, `apmType`, `recommendedAction` - **MISSING**
- ❌ `workOrderId`, `failureMode`, `defectiveQuantity` - **MISSING**
- ❌ `shift`, `crew`, `auditTrail`, `lossCategory`, `operatorName`, `reasonCodeId`, `duration` - **MISSING**

**Database Actually Has:**
- `id`, `created_at`, `updated_at`, `tenant_id`, `organization_id`, `unit_id`
- `event_type`, `event_name`, `start_time`, `end_time`, `duration`, `status`, `severity`
- `impact_code_id`, `description`

**Impact:**
- Frontend validation requires `operatorName`, `shift`, `crew` for ProductionOutput events
- Frontend uses `eventId` for unique identification
- Many event-type-specific fields are missing

---

### 2. Production Losses

**Frontend Requires (from `MasterDataService.ts`):**
- ✅ `id`, `planId`, `period`, `tenantId`, `createdAt`, `updatedAt` - **EXISTS**
- ❌ `actual` - **MISSING** ⚠️ **REQUIRED**
- ❌ `shortRangePlan` - **MISSING** ⚠️ **REQUIRED**
- ❌ `losses` - **MISSING** ⚠️ **REQUIRED**
- ❌ `unaccountedLoss` - **MISSING** ⚠️ **REQUIRED**
- ❌ `action` - **MISSING** ⚠️ **REQUIRED** ('Reconcile' | 'RCA Required' | 'Closed')

**Database Actually Has:**
- `id`, `created_at`, `updated_at`, `tenant_id`, `organization_id`, `plan_id`, `period`
- `loss_type`, `loss_category`, `quantity`, `cost`, `description`

**Impact:**
- ❌ **CRITICAL**: Frontend creates/updates ProductionLoss with `actual`, `shortRangePlan`, `losses`, `unaccountedLoss`, `action`
- These fields are used in calculations and workflows
- Database has completely different structure (`loss_type`, `loss_category`, `quantity`, `cost`)

---

### 3. RCAs

**Frontend Requires (from `MasterDataService.ts`):**
- ✅ `id`, `eventId`, `title`, `description`, `status`, `priority`, `tenantId`, `createdAt`, `updatedAt` - **EXISTS**
- ✅ `rootCause` - **EXISTS** (as `root_cause`)
- ❌ `teamLeadId` - **MISSING** (DB has `assigned_to` but not `teamLeadId`)
- ❌ `teamMemberIds` - **MISSING** (DB has `team_members` as JSON string)
- ❌ `targetCloseDate`, `actualCloseDate` - **MISSING** (DB has `target_completion_date`, `actual_completion_date`)
- ❌ `recommendations` - **MISSING** (Should be in separate table `rca_recommendations`)
- ❌ `logicTree`, `evidence` - **MISSING** (Should be in separate tables)
- ❌ `templateId`, `teamCharter`, `eventDiagram` - **MISSING**
- ❌ `preFailureRate`, `postFailureRate`, `failureCostPerIncident`, `implementationCost` - **MISSING**
- ❌ `timeToResolution`, `timeToImplementation`, `effectivenessScore`, `lastUpdated`, `trackingNotes` - **MISSING**
- ❌ `phaseTimeline`, `calculatedROI`, `costSavings`, `downtimeReduction`, `productivityImprovement` - **MISSING**

**Database Actually Has:**
- `id`, `created_at`, `updated_at`, `tenant_id`, `organization_id`, `event_id`
- `rca_number`, `title`, `description`, `status`, `priority`
- `assigned_to`, `team_members` (NVARCHAR(MAX) - JSON string)
- `start_date`, `target_completion_date`, `actual_completion_date`, `root_cause`

**Impact:**
- Frontend expects complex nested objects (`recommendations[]`, `logicTree[]`, `evidence[]`)
- Database stores these in separate tables or JSON columns
- Many tracking/metric fields are missing

---

## Solutions

### Option 1: Add Missing Columns to Database (RECOMMENDED)

Create a database migration to add all missing columns:

**For Production Events:**
```sql
ALTER TABLE production_events
ADD COLUMN event_id VARCHAR(255),
ADD COLUMN plan_id VARCHAR(36),
ADD COLUMN asset_id VARCHAR(36),
ADD COLUMN oee_code_id VARCHAR(36),
ADD COLUMN rca_id VARCHAR(36),
ADD COLUMN source VARCHAR(50),
ADD COLUMN quantity DECIMAL(15,2),
ADD COLUMN cost DECIMAL(15,2),
-- ... all other missing fields
```

**For Production Losses:**
```sql
ALTER TABLE production_losses
ADD COLUMN actual DECIMAL(15,4),
ADD COLUMN short_range_plan DECIMAL(15,4),
ADD COLUMN losses DECIMAL(15,4),
ADD COLUMN unaccounted_loss DECIMAL(15,4),
ADD COLUMN action VARCHAR(50)
```

**Pros:**
- ✅ Full functionality preserved
- ✅ Data integrity maintained
- ✅ No data loss

**Cons:**
- Requires migration script
- Database schema becomes larger

---

### Option 2: Store Extra Fields in JSON Column (FLEXIBLE)

Add a single JSON column to store all extra fields:

```sql
ALTER TABLE production_events
ADD COLUMN additional_data NVARCHAR(MAX); -- Store JSON

ALTER TABLE production_losses
ADD COLUMN additional_data NVARCHAR(MAX); -- Store JSON
```

Then use TypeORM transformers to serialize/deserialize:

```typescript
@Column({
  name: 'additional_data',
  type: 'nvarchar',
  length: 'MAX',
  nullable: true,
  transformer: {
    to: (value: any) => value ? JSON.stringify(value) : null,
    from: (value: string | null) => value ? JSON.parse(value) : {}
  }
})
additionalData?: {
  actual?: number;
  shortRangePlan?: number;
  // ... other fields
}
```

**Pros:**
- ✅ Flexible schema
- ✅ No migration needed for future fields
- ✅ Works with existing data

**Cons:**
- ❌ Can't query JSON fields easily in SQL
- ❌ Less type-safe

---

### Option 3: Map Existing Fields (PARTIAL SOLUTION)

For Production Losses, map existing database fields to frontend expectations:
- Map `quantity` → `actual`
- Map `cost` → calculate `losses`
- Store `action` in `description` or add column

**Pros:**
- Quick fix for some fields

**Cons:**
- ❌ Data semantics don't match
- ❌ Still missing many fields
- ❌ Workarounds are fragile

---

## Recommendation

**Option 1 (Add Missing Columns)** is the best solution because:

1. ✅ Preserves all frontend functionality
2. ✅ Maintains data integrity
3. ✅ Allows proper SQL queries
4. ✅ Type-safe TypeORM entities

We should create a migration script to add all missing columns matching the frontend requirements.

---

## Next Steps

1. Create comprehensive migration script
2. Add all missing columns to match frontend interfaces
3. Update entities to map to new columns
4. Test end-to-end functionality

