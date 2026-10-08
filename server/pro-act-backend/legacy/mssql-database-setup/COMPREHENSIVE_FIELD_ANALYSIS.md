# Comprehensive Field Analysis: Frontend vs Backend

This document analyzes ALL fields used in the frontend and compares them with backend entities and database schema.

## Analysis Method
1. Scan all frontend TypeScript interfaces
2. Compare with backend entity definitions
3. Compare with database schema
4. Create migration script for missing fields

---

## 1. Production Plan

### Frontend Interface Fields:
- `name` ✓
- `unitId` ✓
- `productId` ✓
- `plannedQuantity` ✓
- `toleranceLimit` ❌ **MISSING**
- `startDate` ✓
- `endDate` ✓
- `tenantId` ✓
- `planBasis` ❌ **MISSING**
- `usefulProductionTime` ❌ **MISSING** (JSON)
- `recurrence` ❌ **MISSING**
- `dataEntryFrequency` ❌ **MISSING**
- `status` ✓
- `actualQuantity` ✓
- `shift` ❌ **MISSING**
- `crew` ❌ **MISSING**
- `plannerNotes` ❌ **MISSING**
- `comments` ❌ **MISSING** (JSON array)
- `approvalStatus` ❌ **MISSING**
- `submittedBy` ❌ **MISSING**
- `submittedAt` ❌ **MISSING**
- `reviewedBy` ❌ **MISSING**
- `reviewedAt` ❌ **MISSING**
- `approvedBy` ❌ **MISSING**
- `approvedAt` ❌ **MISSING**
- `rejectionReason` ❌ **MISSING**
- `customAttributes` ❌ **MISSING** (JSON)
- `auditTrail` ❌ **MISSING** (JSON array)

### Missing Fields Count: **17 fields**

---

## 2. Production Plan Template

### Frontend Interface Fields:
- `name` ✓
- `description` ✓
- `unitId` ❌ **MISSING** (in template_data JSON)
- `productIds` ❌ **MISSING** (in template_data JSON)
- `planBasis` ❌ **MISSING** (in template_data JSON)
- `startDate` ❌ **MISSING** (in template_data JSON)
- `endDate` ❌ **MISSING** (in template_data JSON)
- `recurrence` ❌ **MISSING** (in template_data JSON)
- `tenantId` ✓
- `orgId` ✓ (as organizationId)
- `version` ❌ **MISSING**
- `usefulProductionTime` ❌ **MISSING** (in template_data JSON)
- `dataEntryFrequency` ❌ **MISSING** (in template_data JSON)

**Note:** These fields may be stored in `template_data` JSON, but frontend expects direct fields.

### Missing Direct Fields Count: **9 fields** (or ensure template_data contains them)

---

## 3. Impact Code

### Frontend Interface Fields:
- `code` ✓
- `name` ✓
- `description` ✓
- `category` ❌ **MISSING** ('Quality' | 'Availability' | 'Performance')
- `costPerUnit` ❌ **MISSING**
- `costPerHour` ❌ **MISSING**
- `costBasis` ❌ **MISSING** ('perUnit' | 'perHour')
- `tenantId` ✓

### Backend Has (but frontend doesn't use):
- `severity` (not in frontend interface)
- `color` (not in frontend interface)

### Missing Fields Count: **4 fields**

---

## 4. OEE Code

### Frontend Interface Fields:
- `code` ✓
- `name` ✓
- `description` ✓
- `category` ✓ ('Planned' | 'Unplanned')
- `impactType` ❌ **MISSING** ('Availability' | 'Performance' | 'Quality')
- `tenantId` ✓

### Missing Fields Count: **1 field**

---

## 5. Product

### Frontend Interface Fields:
- `name` ✓
- `code` ✓
- `unitOfMeasure` ✓
- `description` ✓
- `standardCost` ✓
- `tenantId` ✓ (backend has it)

### Missing Fields Count: **0 fields** (all present!)

---

## 6. Asset

Already handled in previous migration - all fields present ✓

---

## 7. Unit

Already handled in previous migration - all fields present ✓

---

## 8. Tenant

Already handled in previous migration - all fields present ✓

---

## 9. Organization

Already handled in previous migration - all fields present ✓

---

## Summary

| Entity | Missing Fields | Priority |
|--------|---------------|----------|
| ProductionPlan | 17 fields | **HIGH** |
| ProductionPlanTemplate | 9 fields (or verify template_data) | **HIGH** |
| ImpactCode | 4 fields | **HIGH** |
| OEECode | 1 field | **MEDIUM** |
| Product | 0 fields | ✓ Complete |

**Total Missing Fields: 31 fields across 4 entities**

---

## Next Steps

1. Create comprehensive migration script
2. Update all entity definitions
3. Update all DTOs
4. Test integration

