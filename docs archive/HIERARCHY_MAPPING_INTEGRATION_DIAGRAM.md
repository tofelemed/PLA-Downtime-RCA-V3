# 🔗 Hierarchy Mapping Integration Diagram

## How Hierarchy Mapping Uses Your Existing Hierarchy

### **Your Existing Hierarchy (Already in Database):**

```
┌─────────────────────────────────────────────────────────┐
│              YOUR EXISTING HIERARCHY                    │
│              (Already in Database)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────┐
│ organizations       │  Table: organizations
│ ─────────────────── │
│ • id (UUID)         │  Example: "org-123"
│ • code              │          "ADNOC"
│ • name              │          "ADNOC Organization"
│ • description       │
└─────────────────────┘
           │
           │ organization_id
           ▼
┌─────────────────────┐
│ tenants             │  Table: tenants
│ ─────────────────── │
│ • id (UUID)         │  Example: "tenant-456"
│ • code              │          "PLANT_A"
│ • name              │          "Plant A"
│ • organization_id   │          "org-123"
└─────────────────────┘
           │
           │ tenant_id
           ▼
┌─────────────────────┐
│ units               │  Table: units
│ ─────────────────── │
│ • id (UUID)         │  Example: "unit-789"
│ • code              │          "LINE1"
│ • name              │          "Production Line 1"
│ • tenant_id         │          "tenant-456"
└─────────────────────┘
           │
           │ unit_id
           ▼
┌─────────────────────┐
│ assets              │  Table: assets
│ ─────────────────── │
│ • id (UUID)         │  Example: "asset-101"
│ • code              │          "PUMP1"
│ • name              │          "Pump 1"
│ • unit_id           │          "unit-789"
│ • tenant_id         │          "tenant-456"
└─────────────────────┘
```

---

### **NEW: Hierarchy Mapping Table (References Existing Hierarchy):**

```
┌─────────────────────────────────────────────────────────┐
│          NEW: HIERARCHY MAPPING TABLE                   │
│          (References Existing Hierarchy IDs)            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ source_hierarchy_mappings                   │  Table: source_hierarchy_mappings
│ ─────────────────────────────────────────── │
│ • id (UUID)                                 │
│ • source_type (PI, OPCUA, etc.)            │
│ • source_identifier (external ID)          │  Example: "PI\\Plant1\\Line1\\Pump1"
│ • target_type (unit, asset, tenant, org)   │          "asset"
│ • target_id (UUID) ───────────┐            │  ──────── "asset-101" ───┐
│ • tenant_id (UUID) ───────────┼────────────│  ──────── "tenant-456" ──┼──┐
│ • organization_id (UUID) ─────┼────────────│  ──────── "org-123" ─────┼──┼──┐
│ • is_pattern (boolean)        │            │                           │  │  │
│ • pattern (string)            │            │                           │  │  │
│ • priority (int)              │            │                           │  │  │
│ • is_active (boolean)         │            │                           │  │  │
└───────────────────────────────┼────────────┘                           │  │  │
                                │                                        │  │  │
        References existing ────┼────────────────────────────────────────┼──┼──┘
        hierarchy by ID         │                                        │  │
                                │                                        │  │
                                ▼                                        │  │
                        ┌───────────────┐                                │  │
                        │ assets table  │◄───────────────────────────────┘  │
                        │ id = asset-101│                                   │
                        └───────────────┘                                   │
                                │                                           │
                                ▼                                           │
                        ┌───────────────┐                                   │
                        │ units table   │◄──────────────────────────────────┘
                        │ id = unit-789 │
                        └───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ tenants table │
                        │ id = tenant-456│
                        └───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ organizations │
                        │ id = org-123  │
                        └───────────────┘
```

---

## Complete Data Flow Example

### **Step 1: Event Arrives from External Source**

```
PI Event Frame:
  WebId: "F1DPqQ_8kaqkDxyz"
  Path: "PI\\Plant1\\Line1\\Pump1"
  Name: "Production Loss Event"
```

### **Step 2: System Looks Up Mapping**

```
Query: source_hierarchy_mappings table
  WHERE source_identifier = "PI\\Plant1\\Line1\\Pump1"
     OR pattern matches "PI\\Plant1\\Line1\\*"
  ORDER BY priority DESC
```

### **Step 3: Mapping Found (Returns IDs)**

```
Mapping Result:
  {
    targetType: "asset",
    targetId: "asset-101",      ← References assets table!
    tenantId: "tenant-456",     ← References tenants table!
    organizationId: "org-123"   ← References organizations table!
  }
```

### **Step 4: System Builds Complete Hierarchy**

```
Using targetId = "asset-101":

1. Look up Asset in assets table:
   SELECT * FROM assets WHERE id = 'asset-101'
   → Returns: { id: "asset-101", name: "Pump 1", unit_id: "unit-789" }

2. Look up Unit in units table:
   SELECT * FROM units WHERE id = 'unit-789'
   → Returns: { id: "unit-789", name: "Production Line 1", tenant_id: "tenant-456" }

3. Look up Tenant in tenants table:
   SELECT * FROM tenants WHERE id = 'tenant-456'
   → Returns: { id: "tenant-456", name: "Plant A", organization_id: "org-123" }

4. Look up Organization in organizations table:
   SELECT * FROM organizations WHERE id = 'org-123'
   → Returns: { id: "org-123", name: "ADNOC Organization" }
```

### **Step 5: Complete Hierarchy IDs Returned**

```
Final Result:
  {
    organizationId: "org-123",      ← From organizations table
    tenantId: "tenant-456",         ← From tenants table
    unitId: "unit-789",             ← From units table (via asset.unit_id)
    assetId: "asset-101"            ← From assets table (from mapping)
  }
```

### **Step 6: Event Tagged with Hierarchy**

```
ProductionEvent created:
  {
    eventId: "event-001",
    assetId: "asset-101",      ← From mapping lookup
    unitId: "unit-789",        ← From asset.unit_id lookup
    tenantId: "tenant-456",    ← From unit.tenant_id lookup
    organizationId: "org-123", ← From tenant.organization_id lookup
    description: "Production Loss Event",
    source: "PI"
  }
```

---

## Database Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         EXISTING HIERARCHY                           │
│                    (Already in Your Database)                        │
└──────────────────────────────────────────────────────────────────────┘

organizations (org-123)
    │
    ├── organization_id
    │
    ▼
tenants (tenant-456)
    │
    ├── tenant_id
    │
    ▼
units (unit-789)
    │
    ├── unit_id
    │
    ▼
assets (asset-101)


┌──────────────────────────────────────────────────────────────────────┐
│                         NEW MAPPING TABLE                             │
│            (References Existing Hierarchy by ID)                     │
└──────────────────────────────────────────────────────────────────────┘

source_hierarchy_mappings
    │
    ├── target_id: "asset-101" ──────────────┐
    │                                          │
    ├── tenant_id: "tenant-456" ──────────────┼─────┐
    │                                          │     │
    └── organization_id: "org-123" ───────────┼─────┼─────┐
                                               │     │     │
        ┌──────────────────────────────────────┘     │     │
        │                                            │     │
        ▼                                            │     │
   assets table                                      │     │
   id = asset-101 ──────────────────────────────────┘     │
        │                                                  │
        ├── unit_id: "unit-789" ──────────────────────────┘
        │
        ▼
   units table
   id = unit-789
        │
        ├── tenant_id: "tenant-456"
        │
        ▼
   tenants table
   id = tenant-456
        │
        ├── organization_id: "org-123"
        │
        ▼
   organizations table
   id = org-123
```

---

## Key Points

### ✅ **Mappings Reference Existing Entities**

The `source_hierarchy_mappings` table stores:
- **`target_id`**: UUID that references an existing Unit, Asset, Tenant, or Organization ID
- **`tenant_id`**: UUID that references an existing Tenant ID
- **`organization_id`**: UUID that references an existing Organization ID

### ✅ **No Data Duplication**

- Mappings do **NOT** create new hierarchy entities
- They only store **references** (IDs) to existing ones
- Your existing hierarchy tables remain unchanged

### ✅ **Uses Your Existing Data**

- When creating a mapping, you select from existing Units/Assets/Tenants/Organizations
- The mapping stores the **ID** of the selected entity
- The seeder uses existing hierarchy IDs when creating test mappings

### ✅ **Tenant Isolation**

- All mappings are filtered by `tenant_id`
- Uses the same tenant structure as your existing hierarchy
- Ensures data isolation between tenants

---

## Example: Real Database Query

```sql
-- Your existing hierarchy (already in database)
SELECT id, code, name FROM organizations WHERE id = 'org-123';
-- Result: org-123 | ADNOC | ADNOC Organization

SELECT id, code, name, organization_id FROM tenants WHERE id = 'tenant-456';
-- Result: tenant-456 | PLANT_A | Plant A | org-123

SELECT id, code, name, tenant_id FROM units WHERE id = 'unit-789';
-- Result: unit-789 | LINE1 | Production Line 1 | tenant-456

SELECT id, code, name, unit_id, tenant_id FROM assets WHERE id = 'asset-101';
-- Result: asset-101 | PUMP1 | Pump 1 | unit-789 | tenant-456


-- NEW: Mapping table (references existing hierarchy)
SELECT target_id, target_type, tenant_id, organization_id 
FROM source_hierarchy_mappings 
WHERE id = 'mapping-999';
-- Result: asset-101 | asset | tenant-456 | org-123
--                    ↑              ↑            ↑
--              References    References  References
--              assets.id   tenants.id  organizations.id
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Existing Hierarchy** | Already in database: `organizations`, `tenants`, `units`, `assets` tables |
| **New Mapping Table** | `source_hierarchy_mappings` table |
| **Relationship** | Mappings store **IDs** that reference existing hierarchy entities |
| **Data Duplication** | ❌ No - mappings only reference, don't duplicate |
| **Storage Location** | ✅ Backend database (MS SQL Server) |
| **Integration** | Uses existing Unit/Asset/Tenant/Organization IDs |

**The hierarchy mapping system is a linking layer that connects external sources to your existing internal hierarchy!** 🔗

