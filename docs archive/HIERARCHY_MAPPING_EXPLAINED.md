# 🗺️ How Hierarchy Mapping Works - Explained

## 📋 Your Question

> "If I map a PI WebID to a tenant, does that mean ALL events related to that WebID will be linked to that tenant?"

**Short Answer:** Yes! But it depends on **what level** you map to. Let me explain how it works.

---

## 🎯 How Mapping Works - Step by Step

### **The Mapping Process:**

When an event comes from an external source (like PI), the system:

1. **Receives the event** with source information (WebID, path, etc.)
2. **Looks up mappings** using the source identifier
3. **Applies the highest priority mapping** that matches
4. **Tags the event** with ProAct hierarchy IDs (`tenantId`, `unitId`, `assetId`, `organizationId`)
5. **Stores the event** in the database with these tags

---

## 📍 Mapping to Different Levels

### **1. Mapping to TENANT Level**

**Example:**
```
Mapping:
  sourceType: "PI"
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"  (PI WebID)
  targetType: "tenant"
  targetId: "tenant-456"  (Your ProAct Tenant ID)
```

**Result:**
- ✅ ALL events from this PI WebID → `tenantId: "tenant-456"`
- ⚠️ Events will have `tenantId` but **NO** `unitId` or `assetId`
- ⚠️ You'll need to manually assign or use other mappings for unit/asset

**Use Case:** When you want all events from a PI element to belong to a tenant, but not tied to a specific unit or asset yet.

---

### **2. Mapping to UNIT Level (More Common)**

**Example:**
```
Mapping:
  sourceType: "PI"
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"  (PI WebID)
  targetType: "unit"
  targetId: "unit-789"  (Your ProAct Unit ID)
```

**Result:**
- ✅ ALL events from this PI WebID → `unitId: "unit-789"`
- ✅ The system automatically adds `tenantId` from the unit's parent tenant
- ⚠️ Events will have `unitId` and `tenantId` but **NO** `assetId`

**Use Case:** When a PI element represents a production line or unit, and all events from it should go to that unit.

---

### **3. Mapping to ASSET Level (Most Specific)**

**Example:**
```
Mapping:
  sourceType: "PI"
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"  (PI WebID)
  targetType: "asset"
  targetId: "asset-101"  (Your ProAct Asset ID)
```

**Result:**
- ✅ ALL events from this PI WebID → `assetId: "asset-101"`
- ✅ The system automatically adds `unitId` from the asset's parent unit
- ✅ The system automatically adds `tenantId` from the unit's parent tenant
- ✅ Events will have complete hierarchy: `organizationId`, `tenantId`, `unitId`, `assetId`

**Use Case:** When a PI element represents a specific piece of equipment/asset, and all events should be tagged to that asset.

---

## 🔄 Multiple Mappings & Priority

### **Priority System:**

The system checks mappings in this order:

1. **Priority 1: Direct Mapping** (Exact match)
   - Exact WebID match
   - Highest priority number wins if multiple matches

2. **Priority 2: Pattern Mapping**
   - Pattern like `PI\\Plant1\\Line1\\*`
   - Matches multiple WebIDs at once

3. **Priority 3: Path Parsing**
   - Extracts hierarchy from path structure
   - Example: `PI\\Plant1\\Line1\\Machine1` → maps to hierarchy

4. **Priority 4: Connection Defaults**
   - Fallback to connection-level defaults

### **Example Scenario:**

```
Mapping 1 (Priority: 90):
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  targetType: "asset"
  targetId: "asset-101"

Mapping 2 (Priority: 50):
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  targetType: "tenant"
  targetId: "tenant-456"
```

**Result:** Mapping 1 wins (higher priority), so events → `asset-101` (which also includes tenant-456 automatically).

---

## 🎨 Mapping Types Explained

### **Type 1: Direct Mapping (One-to-One)**

**What it does:**
- Maps a single source identifier to a single hierarchy element
- Most specific mapping type

**Example:**
```
PI WebID: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  ↓ (Direct Mapping)
Asset: "Pump-001"
```

**Result:** ALL events from that WebID → Pump-001

---

### **Type 2: Pattern Mapping (One-to-Many)**

**What it does:**
- Maps multiple source identifiers at once using patterns
- Uses wildcards (`*`) to match multiple items

**Example:**
```
Pattern: "PI\\Plant1\\Line1\\*"
  ↓ (Pattern Mapping)
Unit: "Production Line 1"
```

**Result:**
- `PI\Plant1\Line1\Equipment1` → Production Line 1
- `PI\Plant1\Line1\Equipment2` → Production Line 1
- `PI\Plant1\Line1\Sensor1` → Production Line 1
- ALL elements under `PI\Plant1\Line1\` → Production Line 1

---

### **Type 3: Path Parsing (Automatic Extraction)**

**What it does:**
- Automatically extracts hierarchy from path structure
- Parses the path segments and matches to ProAct hierarchy

**Example:**
```
PI Path: "PI\\Acme Corp\\Plant A\\Line 1\\Machine 1"
  ↓ (Path Parsing)
Organization: "Acme Corp"
Tenant: "Plant A"
Unit: "Line 1"
Asset: "Machine 1"
```

**Result:** System automatically finds matching ProAct hierarchy by name.

---

## 🔍 Real-World Examples

### **Example 1: Mapping PI Element to Tenant**

**Setup:**
```
Create Mapping:
  Source Type: PI
  Source Identifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz" (PI WebID)
  Target Type: Tenant
  Target: "Plant A"
```

**When Event Arrives:**
```
Event from PI:
  webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  path: "PI\\Plant1\\Line1\\Equipment1"
  timestamp: "2025-01-15T10:00:00Z"
  value: 75.5

System Processing:
  1. Look up mapping for webId "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  2. Found mapping → Tenant "Plant A"
  3. Tag event with tenantId: "tenant-plant-a-id"

Stored Event:
  {
    webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz",
    tenantId: "tenant-plant-a-id",
    unitId: null,  // Not mapped
    assetId: null,  // Not mapped
    value: 75.5,
    timestamp: "2025-01-15T10:00:00Z"
  }
```

**Result:** ✅ All events from this WebID are tagged with `tenantId: "tenant-plant-a-id"`

---

### **Example 2: Mapping PI Element to Asset (Better)**

**Setup:**
```
Create Mapping:
  Source Type: PI
  Source Identifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz" (PI WebID)
  Target Type: Asset
  Target: "Pump-001" (which belongs to Unit "Line-1", Tenant "Plant A")
```

**When Event Arrives:**
```
Event from PI:
  webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  path: "PI\\Plant1\\Line1\\Pump1"
  timestamp: "2025-01-15T10:00:00Z"
  value: 75.5

System Processing:
  1. Look up mapping for webId "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  2. Found mapping → Asset "Pump-001"
  3. System automatically gets:
     - assetId from mapping: "asset-pump-001-id"
     - unitId from asset.parent: "unit-line-1-id"
     - tenantId from unit.parent: "tenant-plant-a-id"

Stored Event:
  {
    webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz",
    tenantId: "tenant-plant-a-id",     // ✅ Auto-filled
    unitId: "unit-line-1-id",          // ✅ Auto-filled
    assetId: "asset-pump-001-id",      // ✅ From mapping
    value: 75.5,
    timestamp: "2025-01-15T10:00:00Z"
  }
```

**Result:** ✅ All events from this WebID are tagged with complete hierarchy

---

### **Example 3: Pattern Mapping (Bulk Mapping)**

**Setup:**
```
Create Pattern Mapping:
  Source Type: PI
  Pattern: "PI\\Plant1\\Line1\\*"
  Target Type: Unit
  Target: "Production Line 1"
```

**When Multiple Events Arrive:**
```
Event 1:
  webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz-1"
  path: "PI\\Plant1\\Line1\\Equipment1"
  → Matches pattern → Unit "Production Line 1"

Event 2:
  webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz-2"
  path: "PI\\Plant1\\Line1\\Equipment2"
  → Matches pattern → Unit "Production Line 1"

Event 3:
  webId: "F1AbCdEfGhIjKlMnOpQrStUvWxYz-3"
  path: "PI\\Plant1\\Line2\\Equipment1"
  → Doesn't match pattern → No mapping
```

**Result:** ✅ All events under `PI\Plant1\Line1\` → Unit "Production Line 1"

---

## ⚠️ Important Considerations

### **1. Mapping Granularity**

**Question:** Should you map to Tenant, Unit, or Asset?

**Recommendation:**
- ✅ **Map to Asset** when possible (most specific)
- ✅ **Map to Unit** for production lines
- ⚠️ **Map to Tenant** only if you can't be more specific

**Why?** More specific mappings allow better filtering and analysis.

---

### **2. Multiple Events from Same Source**

**Question:** If I map a WebID to a tenant, do ALL events from that WebID get linked?

**Answer:** YES! Once you create a mapping:
- ✅ **ALL future events** from that source identifier will be tagged
- ✅ **Automatic tagging** happens during event ingestion
- ✅ **No manual tagging** needed for each event

---

### **3. Mapping Hierarchy**

**Important:** When you map to a specific level, parent levels are automatically included:

```
Mapping to Asset:
  → assetId is set from mapping
  → unitId is auto-filled from asset.parent
  → tenantId is auto-filled from unit.parent
  → organizationId is auto-filled from tenant.parent

Mapping to Unit:
  → unitId is set from mapping
  → tenantId is auto-filled from unit.parent
  → organizationId is auto-filled from tenant.parent
  → assetId is null

Mapping to Tenant:
  → tenantId is set from mapping
  → organizationId is auto-filled from tenant.parent
  → unitId is null
  → assetId is null
```

---

### **4. Overriding Mappings**

**Question:** Can I have multiple mappings for the same source?

**Answer:** YES, but priority determines which one wins:

```
Mapping A (Priority: 90):
  WebID → Asset "Pump-001"

Mapping B (Priority: 50):
  WebID → Tenant "Plant A"
```

**Result:** Mapping A wins (higher priority), so events go to Pump-001.

---

## 🎯 Best Practices

### **✅ DO:**

1. **Map to the most specific level possible**
   - Asset > Unit > Tenant > Organization

2. **Use pattern mappings for bulk mapping**
   - `PI\\Plant1\\Line1\\*` → Unit "Line 1"
   - Saves time mapping hundreds of elements

3. **Set appropriate priorities**
   - Specific mappings: Priority 90-100
   - Pattern mappings: Priority 50-80
   - Defaults: Priority 1-49

4. **Use descriptive descriptions**
   - Helps understand what the mapping does

---

### **❌ DON'T:**

1. **Don't map to tenant if you can map to unit/asset**
   - Less useful for filtering and analysis

2. **Don't create conflicting mappings without priorities**
   - Set priorities clearly

3. **Don't forget to activate mappings**
   - Set `isActive: true` for mappings to work

---

## 📊 Summary

### **Your Original Question:**

> "If I map a PI WebID to a tenant, does that mean ALL events related to that WebID will be linked to that tenant?"

**Answer:** 

✅ **YES!** All events from that WebID will be tagged with that `tenantId`.

However, **better approach:**
- ✅ Map to **Unit** or **Asset** level if possible
- ✅ System automatically includes parent `tenantId`
- ✅ More specific = better filtering and analysis

**Example:**
```
Instead of:
  WebID → Tenant "Plant A"

Better:
  WebID → Asset "Pump-001"
  (System auto-adds: unitId, tenantId, organizationId)
```

---

## 🔧 How to Use in Practice

1. **Create Mappings** in Hierarchy Mapping UI
2. **Set Priority** (higher = checked first)
3. **Choose Target Level** (Asset > Unit > Tenant)
4. **Activate Mapping** (`isActive: true`)
5. **Events automatically tagged** when they arrive

**That's it!** The system handles the rest automatically. 🎉

