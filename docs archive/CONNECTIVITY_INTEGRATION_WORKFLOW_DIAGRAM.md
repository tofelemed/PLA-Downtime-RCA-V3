# 🔄 Connectivity Integration - Complete Workflow Diagram

## 📊 Visual Event Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONFIGURATION PHASE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Connection  │  Configure PI Web API endpoint & credentials
│     Tab      │  ──────────────────────────────────────────────┐
└──────┬───────┘                                                 │
       │                                                         │
       └─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HIERARCHY MAPPING (Universal System)                      │
│                                                                              │
│  Map PI WebIds → Internal Hierarchy                                         │
│                                                                              │
│  Strategies:                                                                 │
│  ├─ Direct:    WebId → Asset/Unit                                           │
│  ├─ Pattern:   "PI\\Plant1\\Line1\\*" → Unit                                │
│  ├─ Path Parse: Extract hierarchy from path                                 │
│  └─ Defaults:  Connection-level defaults                                    │
│                                                                              │
│  Storage: source_hierarchy_mappings table                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT MAPPING (Mapping Tab)                             │
│                                                                              │
│  1. Template Discovery                                                       │
│     └─ Scan Event Frames → Extract templates                                │
│                                                                              │
│  2. Template → Event Type Mapping                                           │
│     "Production Loss" → ProductionLoss                                       │
│     "IOW Deviation"  → IOW                                                  │
│     etc.                                                                     │
│                                                                              │
│  3. Attribute → App Field Mapping                                           │
│     EF "Duration" → App "duration"                                          │
│     EF "Cost"     → App "cost"                                              │
│     etc.                                                                     │
│                                                                              │
│  Storage: pi_mappings table                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIONAL: Historian Tags                                  │
│                                                                              │
│  Configure tags for time-series monitoring                                  │
│  (Can be linked to hierarchy for filtering)                                 │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       SYNCHRONIZATION PHASE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      SYNC EXECUTION (Sync Tab)                               │
│                                                                              │
│  Options:                                                                    │
│  ├─ Manual Backfill:  Time range sync                                       │
│  ├─ Delta Sync:       From last watermark                                   │
│  └─ Auto Sync:        Scheduled jobs (separate component)                   │
│                                                                              │
│  Fetches Event Frames from PI:                                              │
│  └─ Filtered by scope, template, time range                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT PROCESSING (Per Event Frame)                        │
└─────────────────────────────────────────────────────────────────────────────┘

For each Event Frame:

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Determine Event Type                                               │
│                                                                              │
│  Event Frame                                                                 │
│  ├─ Template: "Production Loss"                                             │
│  └─ Lookup: Template → Event Type Mapping                                   │
│     └─ Result: ProductionLoss                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Extract Hierarchy Context                                          │
│                                                                              │
│  Event Frame                                                                 │
│  ├─ Primary Element WebId: "F1AbCdEf..."                                    │
│  ├─ Primary Element Path: "PI\\Plant1\\Line1\\Pump1"                       │
│  └─ Hierarchy Mapping Lookup (Priority Order):                              │
│     1. Direct Mapping:      Exact WebId match                               │
│     2. Pattern Mapping:     Wildcard pattern match                          │
│     3. Path Parsing:        Extract from path                               │
│     4. Connection Defaults: Connection-level defaults                       │
│     5. Legacy AF Binding:   Fallback (if enabled)                           │
│                                                                              │
│     Result: { tenantId, unitId, assetId, organizationId }                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Map Attributes                                                      │
│                                                                              │
│  Event Frame Attributes                                                      │
│  ├─ "Duration": "120"                                                       │
│  ├─ "Cost": "5000"                                                          │
│  ├─ "Description": "Pump failure"                                           │
│  └─ Attribute Mapping Lookup:                                               │
│     "Duration"    → "duration" → 120                                        │
│     "Cost"        → "cost"     → 5000                                       │
│     "Description" → "description" → "Pump failure"                          │
│                                                                              │
│     Result: { duration: 120, cost: 5000, description: "Pump failure" }      │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Create Production Event                                            │
│                                                                              │
│  ProductionEvent {                                                           │
│    eventType: "ProductionLoss",          // From Step 1                    │
│    tenantId: "tenant-456",               // From Step 2                    │
│    unitId: "unit-789",                   // From Step 2                    │
│    assetId: "asset-101",                 // From Step 2                    │
│    organizationId: "org-123",            // From Step 2                    │
│    duration: 120,                        // From Step 3                    │
│    cost: 5000,                           // From Step 3                    │
│    description: "Pump failure",          // From Step 3                    │
│    source: "PI",                         // Always "PI" for PI events      │
│    startTime: "...",                     // From Event Frame               │
│    endTime: "...",                       // From Event Frame               │
│    ...                                   // Other fields                   │
│  }                                                                           │
│                                                                              │
│  Storage: production_events table                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Update Watermark                                                    │
│                                                                              │
│  Store last sync time for delta sync:                                       │
│  └─ pi_sync_watermarks table                                                │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          USAGE PHASE                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT HUB (Display)                                     │
│                                                                              │
│  ProductionEvents appear in appropriate tab:                                 │
│  ├─ Production Loss tab                                                     │
│  ├─ IOW tab                                                                 │
│  ├─ SOL tab                                                                 │
│  ├─ APM tab                                                                 │
│  ├─ Failure WO tab                                                          │
│  └─ Production Output tab                                                   │
│                                                                              │
│  Filtered by hierarchy (tenant, unit, asset)                                │
│  Available for:                                                              │
│  ├─ RCA Analysis                                                            │
│  ├─ Reporting                                                               │
│  ├─ Analytics                                                               │
│  └─ Historian Integration (time-series evidence)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Integration Points Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION TABS                                 │
└─────────────────────────────────────────────────────────────────────────┘

Connection Tab
    │
    ├─→ Used by ALL tabs for PI access
    │
    ├─→ AF Hierarchy Tab
    │   ├─ Load Asset Servers
    │   ├─ Browse AF Elements
    │   └─ Legacy: Create AF Bindings (deprecated)
    │
    ├─→ Event Frames Tab
    │   └─ Fetch Event Frames
    │
    ├─→ Mapping Tab
    │   ├─ Discover Templates
    │   └─ Load Attributes
    │
    ├─→ Historian Tab
    │   └─ Query Time-Series Data
    │
    └─→ Sync & Status Tab
        └─ Execute Sync Operations


┌─────────────────────────────────────────────────────────────────────────┐
│                    HIERARCHY MAPPING SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────┘

Hierarchy Management (Universal Mapping)
    │
    └─→ Used by Sync & Status Tab
        │
        └─→ Event Processing (Step 2)
            └─→ Tags events with hierarchy IDs


┌─────────────────────────────────────────────────────────────────────────┐
│                         MAPPING SYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────┘

Mapping Tab
    │
    ├─→ Template → Event Type
    │   └─→ Used by Sync & Status Tab (Step 1)
    │
    └─→ Attribute → App Field
        └─→ Used by Sync & Status Tab (Step 3)


┌─────────────────────────────────────────────────────────────────────────┐
│                       SYNC SYSTEM                                         │
└─────────────────────────────────────────────────────────────────────────┘

Sync & Status Tab
    │
    ├─→ Uses: Connection Tab (PI access)
    ├─→ Uses: Mapping Tab (templates & attributes)
    ├─→ Uses: Hierarchy Management (hierarchy mapping)
    │
    └─→ Creates: Production Events
        │
        └─→ Event Hub
            └─→ Available for RCA, Reporting, Analytics
```

---

## 📋 Data Flow Summary

### **Configuration Data:**
```
User Input
  → Connection Settings (stored)
  → Hierarchy Mappings (stored in source_hierarchy_mappings)
  → Event Mappings (stored in pi_mappings)
  → Historian Tags (stored in historian_tags)
```

### **Sync Data Flow:**
```
PI System (Event Frames)
  → Fetch (via Connection)
  → Transform (via Mappings)
  → Tag (via Hierarchy Mapping)
  → Store (ProductionEvents)
  → Display (Event Hub)
```

### **Query Data Flow:**
```
User Query (Historian)
  → PI System (Time-Series)
  → Historical Data Points
  → Charts/Tables
  → RCA Evidence
```

---

## 🎯 Key Workflows

### **Workflow 1: Initial Setup**
1. Configure Connection
2. Create Hierarchy Mappings
3. Discover Templates
4. Create Event Mappings
5. (Optional) Configure Historian Tags

### **Workflow 2: Daily Sync**
1. Auto-sync runs on schedule
2. OR Manual sync triggered
3. Events automatically mapped and stored
4. Appear in Event Hub

### **Workflow 3: Event Investigation**
1. View events in Event Hub
2. Query Historian data for time window
3. Use in RCA analysis
4. Generate reports

---

## 🔍 Dependencies

```
Connection Tab
    ↓ (required)
All Other Tabs

Hierarchy Mapping
    ↓ (required for sync)
Sync & Status Tab

Event Mapping
    ↓ (required for sync)
Sync & Status Tab

Sync & Status Tab
    ↓ (creates)
Production Events
    ↓ (displayed in)
Event Hub
```

---

## ✅ Complete Integration Checklist

- [x] Connection configured
- [x] Hierarchy mappings created
- [x] Event mappings configured
- [x] Sync executed
- [x] Events appear in Event Hub
- [x] Events linked to correct hierarchy
- [x] Events have correct event type
- [x] Events have mapped attributes
- [x] Historian tags available (optional)
- [x] Ready for RCA/Reporting

