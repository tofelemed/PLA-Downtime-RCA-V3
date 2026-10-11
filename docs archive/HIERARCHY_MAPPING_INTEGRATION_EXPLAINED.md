# 🔗 Hierarchy Mapping Integration with Existing Hierarchy

## How It Works

The **Hierarchy Mapping** system **references** your existing hierarchy entities (Organizations, Tenants, Units, Assets) that are already stored in your database. It does **NOT** duplicate them - it just maps external source identifiers to their IDs.

---

## Your Existing Hierarchy (Already in Database)

### **Database Tables:**

1. **`organizations`** table
   - Stores Organization entities
   - Columns: `id`, `code`, `name`, `description`, `tenant_id`, `created_at`, `updated_at`

2. **`tenants`** table
   - Stores Tenant/Plant entities
   - Columns: `id`, `code`, `name`, `description`, `organization_id`, `created_at`, `updated_at`

3. **`units`** table
   - Stores Production Unit entities
   - Columns: `id`, `code`, `name`, `description`, `tenant_id`, `organization_id`, `created_at`, `updated_at`

4. **`assets`** table
   - Stores Asset entities
   - Columns: `id`, `code`, `name`, `description`, `unit_id`, `tenant_id`, `organization_id`, `created_at`, `updated_at`

### **Hierarchy Structure:**
```
Organization
  └── Tenant (Plant)
       └── Unit (Production Line)
            └── Asset (Equipment)
```

---

## Hierarchy Mapping Table (NEW)

### **`source_hierarchy_mappings`** table

This table stores **mappings** that link external source identifiers to your existing hierarchy:

| Column | Description | Example |
|--------|-------------|---------|
| `target_id` | **References** existing hierarchy entity ID | Unit ID from `units` table |
| `target_type` | Type of target entity | `'unit'`, `'asset'`, `'tenant'`, `'organization'` |
| `source_identifier` | External source identifier | PI WebId, OPC UA NodeId, etc. |
| `tenant_id` | Tenant ID for filtering | Same tenant as your existing units/assets |
| `organization_id` | Organization ID (optional) | Same org as your existing hierarchy |

---

## How They Work Together

### **Example Flow:**

1. **Existing Hierarchy in Database:**
   ```
   Organization: "ADNOC" (id: org-123)
     └── Tenant: "Plant A" (id: tenant-456)
          └── Unit: "Production Line 1" (id: unit-789)
               └── Asset: "Pump 1" (id: asset-101)
   ```

2. **Create Mapping:**
   ```
   Source Identifier: "PI\\Plant1\\Line1\\Pump1"
   Target Type: "asset"
   Target ID: "asset-101"  ← References existing Asset!
   Tenant ID: "tenant-456" ← References existing Tenant!
   ```

3. **When Event Comes In:**
   - Event has source identifier: `"PI\\Plant1\\Line1\\Pump1"`
   - System finds mapping
   - Returns: `{ assetId: "asset-101", unitId: "unit-789", tenantId: "tenant-456" }`
   - These IDs reference your existing hierarchy entities!

---

## Data Storage Summary

| Data Type | Storage Location | Purpose |
|-----------|-----------------|---------|
| **Organizations** | `organizations` table | Your organization structure |
| **Tenants** | `tenants` table | Your plant/tenant structure |
| **Units** | `units` table | Your production units |
| **Assets** | `assets` table | Your equipment/assets |
| **Mappings** | `source_hierarchy_mappings` table | Links external sources → existing hierarchy IDs |

---

## Key Points

### ✅ **Mappings Reference Existing Entities**

The hierarchy mapping table stores:
- **`target_id`**: UUID of existing Unit, Asset, Tenant, or Organization
- **`target_type`**: Type of entity being referenced
- **`tenant_id`**: Tenant ID for multi-tenancy (same as your existing hierarchy)

### ✅ **No Duplication**

- Mappings do **NOT** create new Units, Assets, Tenants, or Organizations
- They only **reference** existing ones by ID
- Your existing hierarchy structure remains unchanged

### ✅ **Uses Your Existing Data**

When you create a mapping in the UI:
- You select from **existing** Units in your database
- You select from **existing** Assets in your database
- You select from **existing** Tenants/Organizations
- The mapping stores the **ID** of the selected entity

### ✅ **Tenant Isolation**

- Mappings are filtered by `tenant_id`
- Only mappings for your tenant are shown
- Uses the same tenant structure as your existing hierarchy

---

## Example: Complete Flow

### **Step 1: You Have Existing Hierarchy**

Your database already has:
```sql
-- Organizations table
INSERT INTO organizations (id, code, name) 
VALUES ('org-123', 'ADNOC', 'ADNOC Organization');

-- Tenants table
INSERT INTO tenants (id, code, name, organization_id) 
VALUES ('tenant-456', 'PLANT_A', 'Plant A', 'org-123');

-- Units table
INSERT INTO units (id, code, name, tenant_id) 
VALUES ('unit-789', 'LINE1', 'Production Line 1', 'tenant-456');

-- Assets table
INSERT INTO assets (id, code, name, unit_id, tenant_id) 
VALUES ('asset-101', 'PUMP1', 'Pump 1', 'unit-789', 'tenant-456');
```

### **Step 2: Create Hierarchy Mapping**

```sql
-- source_hierarchy_mappings table
INSERT INTO source_hierarchy_mappings (
  id,
  source_type,
  source_identifier,
  target_type,
  target_id,        -- ← References asset-101 from assets table!
  tenant_id,        -- ← References tenant-456 from tenants table!
  organization_id,  -- ← References org-123 from organizations table!
  is_pattern,
  priority,
  is_active
) VALUES (
  'mapping-999',
  'PI',
  'PI\\Plant1\\Line1\\Pump1',
  'asset',
  'asset-101',      -- ← Points to existing Asset!
  'tenant-456',     -- ← Points to existing Tenant!
  'org-123',        -- ← Points to existing Organization!
  0,
  80,
  1
);
```

### **Step 3: When Event Comes In**

```
PI Event arrives:
  - WebId: "F1DPqQ_8kaqkDxyz"
  - Path: "PI\\Plant1\\Line1\\Pump1"

System finds mapping:
  - Matches pattern or identifier
  - Returns: { assetId: "asset-101" }

System looks up existing hierarchy:
  - Asset ID "asset-101" → Finds Asset in assets table
  - Asset.unit_id → Finds Unit "unit-789" in units table
  - Unit.tenant_id → Finds Tenant "tenant-456" in tenants table
  - Tenant.organization_id → Finds Organization "org-123"

Result:
  {
    organizationId: "org-123",
    tenantId: "tenant-456",
    unitId: "unit-789",
    assetId: "asset-101"
  }
```

---

## Frontend Integration

### **When Creating a Mapping:**

1. **UI loads existing hierarchy from database:**
   ```typescript
   const units = await masterDataService.getUnits({ tenantId });
   const assets = await masterDataService.getAssets({ tenantId });
   const tenants = await masterDataService.getTenants();
   const organizations = await masterDataService.getOrganizations();
   ```

2. **User selects from dropdown:**
   - Unit dropdown shows Units from `units` table
   - Asset dropdown shows Assets from `assets` table
   - etc.

3. **When saved, mapping stores the ID:**
   ```typescript
   {
     targetType: 'unit',
     targetId: 'unit-789',  // ← ID from units table!
     tenantId: 'tenant-456' // ← ID from tenants table!
   }
   ```

---

## Seeder Integration

The `HierarchyMappingSeeder` uses your existing hierarchy:

```typescript
// 1. Gets existing units and assets from database
const units = await masterDataService.getUnits({ tenantId });
const assets = await masterDataService.getAssets({ tenantId });

// 2. Creates mappings that reference them
mappings.push({
  targetType: 'unit',
  targetId: units[0].id,  // ← Uses existing Unit ID!
  tenantId: tenantId,     // ← Uses existing Tenant ID!
  // ...
});
```

---

## Summary

### **What's Already in Your Database:**
- ✅ Organizations table
- ✅ Tenants table
- ✅ Units table
- ✅ Assets table

### **What's NEW:**
- ✅ `source_hierarchy_mappings` table
  - Stores mappings that **reference** existing hierarchy IDs
  - Does **NOT** duplicate hierarchy data
  - Just links external sources → existing entity IDs

### **How They Work Together:**
1. Your existing hierarchy (Organizations, Tenants, Units, Assets) stays in their tables
2. Mappings store **references** (IDs) to these existing entities
3. When events come in, mappings return hierarchy IDs
4. System uses these IDs to look up your existing hierarchy entities

---

## Database Relationship

```
Existing Hierarchy:
  organizations (org-123)
    └── tenants (tenant-456)
         └── units (unit-789)
              └── assets (asset-101)

New Mapping Table:
  source_hierarchy_mappings
    └── target_id: "asset-101"  ← References assets table!
    └── tenant_id: "tenant-456" ← References tenants table!
```

**The mapping table references your existing hierarchy - it doesn't duplicate it!** 🔗

