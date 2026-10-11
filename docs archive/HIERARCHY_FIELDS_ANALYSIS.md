# 🔍 Hierarchy Fields Analysis - Frontend vs Backend

## Analysis of Missing Fields in Database

### 1. **Tenant** - Missing Fields

**Frontend Interface:**
```typescript
export interface Tenant extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  organizationId: string;
  isActive: boolean;          // ❌ MISSING
  address?: string;           // ❌ MISSING
  contactPerson?: string;     // ❌ MISSING
  contactEmail?: string;      // ❌ MISSING
  contactPhone?: string;      // ❌ MISSING
  timezone?: string;          // ❌ MISSING
}
```

**Backend Entity (Current):**
- ✅ name, code, description, organizationId
- ❌ isActive, address, contactPerson, contactEmail, contactPhone, timezone

**Frontend Uses:**
- `TenantList.tsx` sends: address, contactEmail, contactPhone, timezone
- `MasterData.tsx` sends: isActive

---

### 2. **Unit** - Missing Fields

**Frontend Interface:**
```typescript
export interface Unit extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  tenantId: string;
  capacity: number;           // ❌ MISSING
  unitOfMeasure: string;      // ❌ MISSING
  idealCycleTime?: number;    // ❌ MISSING
}
```

**Backend Entity (Current):**
- ✅ name, code, description, tenantId, organizationId
- ❌ capacity, unitOfMeasure, idealCycleTime

**Frontend Uses:**
- `UnitList.tsx` sends: capacity, unitOfMeasure, idealCycleTime

---

### 3. **Asset** - Missing Fields

**Frontend Interface:**
```typescript
export interface Asset extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  unitId: string;
  tenantId?: string;
  organizationId?: string;
  assetType: string;          // ❌ MISSING
  manufacturer?: string;      // ❌ MISSING
  model?: string;             // ❌ MISSING
  serialNumber?: string;      // ❌ MISSING
  criticality: string;        // ❌ MISSING
  status: string;             // ❌ MISSING
  location?: string;          // ❌ MISSING
}
```

**Backend Entity (Current):**
- ✅ name, code, description, unitId, tenantId, organizationId
- ❌ assetType, manufacturer, model, serialNumber, criticality, status, location

**Frontend Uses:**
- `AssetList.tsx` sends: assetType, manufacturer, model, serialNumber, criticality, status, location

---

## Summary

| Entity | Missing Fields Count | Fields |
|--------|---------------------|--------|
| **Tenant** | 6 | isActive, address, contactPerson, contactEmail, contactPhone, timezone |
| **Unit** | 3 | capacity, unitOfMeasure, idealCycleTime |
| **Asset** | 7 | assetType, manufacturer, model, serialNumber, criticality, status, location |

**Total Missing Fields: 16**

---

## Next Steps

1. Create migration scripts for each entity
2. Update backend entities
3. Update DTOs
4. Run migrations
5. Test creation/update operations

