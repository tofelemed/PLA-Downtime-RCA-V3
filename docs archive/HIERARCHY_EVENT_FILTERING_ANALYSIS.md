# 🔍 Hierarchy-Based Event Filtering Analysis

## 📋 The Challenge

**Problem Statement:**
- Application has a hierarchy: **Organization → Tenant → Unit → Asset**
- Users select a hierarchy level (e.g., select a Unit)
- All modules filter data based on this selection
- **Events come from multiple sources** (PI, OPC UA, Modbus, MQTT, Database, REST API)
- **Question:** How does the system know which events belong to which hierarchy level, especially when:
  - Events are continuously coming from external sources
  - User changes hierarchy selection in real-time
  - Events need to be filtered dynamically

---

## 🏗️ Current Architecture

### **1. Hierarchy Structure**

```
Organization (Top Level)
    ↓
Tenant (Plant/Factory)
    ↓
Unit (Production Line/Machine)
    ↓
Asset (Equipment/Component)
```

**Frontend Context:**
- `PlantSelectionContext` stores current selection
- Stored in backend via AppSettings API (`plantSelection` key)
- Components access via `usePlantSelection()` hook

**Example Selection:**
```typescript
{
  organization: { id: "org-1", name: "Acme Corp" },
  tenant: { id: "tenant-1", name: "Plant A" },
  unit: { id: "unit-1", name: "Production Line 1" },
  asset: undefined // Optional
}
```

---

### **2. Event Sources**

Events can come from:
1. **PI System** - Event frames from PI Web API
2. **OPC UA** - Alarms and events from OPC UA servers
3. **Modbus** - Data changes triggering events
4. **MQTT** - IoT device telemetry events
5. **Database** - Historical events
6. **REST API** - External system integrations
7. **Manual Entry** - User-created events

---

### **3. Current Event Association (PI Example)**

**How PI Events are Associated:**

1. **AF Bindings:**
   ```
   PI Element (WebId) → Bound Type → Local ID
   Example: "PI\\Equipment\\Line1" → "unit" → "unit-123"
   ```

2. **Event Pulling Process:**
   - Pull event frames from PI
   - Get `PrimaryReferencedElement.WebId` from event frame
   - Look up binding: `bindingMap.get(webId)`
   - If bound to unit: `unitId = binding.localId`
   - If bound to asset: `assetId = binding.localId`
   - Create ProductionEvent with `unitId`/`assetId`

3. **Database Storage:**
   ```typescript
   ProductionEvent {
     id: "...",
     eventId: "pi-web-id-123",
     unitId: "unit-123",      // ✅ From binding
     assetId: "asset-456",    // ✅ From binding
     tenantId: "tenant-1",    // ✅ From connection
     organizationId: "org-1", // ✅ From connection
     // ... other fields
   }
   ```

---

## ⚠️ **THE PROBLEM IDENTIFIED**

### **Issue 1: Association at Pull Time**

**Current Flow:**
```
1. User selects Unit A
2. User pulls events from PI
3. Events are associated with Unit A via bindings
4. ✅ Works if bindings exist
```

**Problem Scenarios:**
1. **Events pulled before binding exists** → Events not associated
2. **Events from source without bindings** → No unitId/assetId
3. **User changes selection** → Already stored events don't update
4. **Real-time events** → Coming continuously, need dynamic filtering

---

### **Issue 2: Real-Time Event Filtering**

**Scenario:**
```
1. User selects Unit A
2. Frontend filters events where unitId = "unit-a" ✅
3. New event comes in from OPC UA for Unit B
4. User switches to Unit B
5. Frontend needs to show Unit B events immediately
```

**Questions:**
- How does frontend know which events belong to Unit B?
- Are events already tagged with unitId/assetId?
- Can we filter in real-time?

---

### **Issue 3: Multiple Source Binding**

**Problem:**
- PI has AF Bindings ✅
- What about OPC UA? → **Missing binding mechanism**
- What about Modbus? → **Missing binding mechanism**
- What about MQTT? → **Missing binding mechanism**
- What about Database? → **Missing binding mechanism**

**Each source needs:**
- A way to map source identifiers → Hierarchy IDs
- Consistent binding mechanism
- Association at event creation time

---

## 🎯 **SOLUTION ARCHITECTURE**

### **Solution 1: Universal Binding System**

**Concept:** Extend binding system to all sources

**Structure:**
```
Source Binding:
  - sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI'
  - sourceId: External identifier (WebId, NodeId, Register, Topic, etc.)
  - boundType: 'unit' | 'asset'
  - localId: Unit ID or Asset ID
  - tenantId: Tenant context
  - organizationId: Organization context
```

**Database Entity (Extended):**
```typescript
SourceBinding {
  id: UUID
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI'
  sourceId: string  // WebId, NodeId, Topic, Register, etc.
  boundType: 'unit' | 'asset'
  localId: string   // Unit ID or Asset ID
  tenantId: string
  organizationId?: string
  isActive: boolean
}
```

---

### **Solution 2: Event Tagging at Creation**

**Principle:** Always tag events with hierarchy IDs when created

**Flow:**
```
1. Event comes from source
2. Look up binding for source identifier
3. If binding exists:
   - Set unitId = binding.localId (if boundType === 'unit')
   - Set assetId = binding.localId (if boundType === 'asset')
4. Set tenantId from connection/config
5. Set organizationId from connection/config
6. Create ProductionEvent with all hierarchy IDs
```

**Example:**
```typescript
// PI Event
const binding = await findBinding('PI', event.primaryAfId);
if (binding?.boundType === 'unit') {
  eventData.unitId = binding.localId;
}

// OPC UA Alarm
const binding = await findBinding('OPCUA', alarm.nodeId);
if (binding?.boundType === 'asset') {
  eventData.assetId = binding.localId;
}

// Modbus Register Change
const binding = await findBinding('Modbus', `${connectionId}:${register}`);
if (binding?.boundType === 'unit') {
  eventData.unitId = binding.localId;
}

// MQTT Topic
const binding = await findBinding('MQTT', message.topic);
if (binding?.boundType === 'asset') {
  eventData.assetId = binding.localId;
}
```

---

### **Solution 3: Real-Time Filtering Strategy**

**Frontend Approach:**

1. **Event Storage:**
   - All events stored with `tenantId`, `unitId`, `assetId`
   - Events queryable by hierarchy level

2. **Selection Change Handler:**
   ```typescript
   useEffect(() => {
     const loadEvents = async () => {
       const filters = {
         tenantId: plantSelection?.tenant?.id,
         unitId: plantSelection?.unit?.id,
         assetId: plantSelection?.asset?.id,
       };
       
       const events = await productionApi.getEvents(filters);
       setEvents(events);
     };
     
     loadEvents();
   }, [plantSelection]);
   ```

3. **Backend API Filtering:**
   ```typescript
   // Backend endpoint
   GET /api/production-events?tenantId=X&unitId=Y&assetId=Z
   
   // SQL Query
   SELECT * FROM production_events
   WHERE tenant_id = :tenantId
     AND (unit_id = :unitId OR :unitId IS NULL)
     AND (asset_id = :assetId OR :assetId IS NULL)
   ```

4. **Real-Time Updates:**
   - WebSocket subscriptions filtered by hierarchy
   - When selection changes, unsubscribe old, subscribe new
   - Backend sends only events matching current selection

---

### **Solution 4: Binding Configuration UI**

**User Flow:**
1. User connects to PI/OPC UA/Modbus/etc.
2. System discovers available nodes/tags/registers
3. User creates bindings:
   - Select source identifier (PI element, OPC UA node, Modbus register)
   - Select target hierarchy level (Unit or Asset)
   - Select specific Unit/Asset
   - Save binding

**Binding Manager:**
- Already exists for PI (`BindingManager.tsx`)
- Needs extension for other sources

---

## 📊 **CURRENT STATE ANALYSIS**

### **✅ What's Working:**

1. **PI Events:**
   - ✅ AF Bindings exist
   - ✅ Events tagged with unitId/assetId during pull
   - ✅ Frontend can filter by hierarchy

2. **Plant Selection:**
   - ✅ Context exists
   - ✅ Stored in backend
   - ✅ Components can access selection

3. **Event Filtering:**
   - ✅ Frontend filters by unitId/assetId
   - ✅ Backend supports filtering via query params

---

### **❌ What's Missing:**

1. **Binding System for Other Sources:**
   - ❌ No OPC UA bindings
   - ❌ No Modbus bindings
   - ❌ No MQTT bindings
   - ❌ No Database bindings
   - ❌ No REST API bindings

2. **Event Association at Pull Time:**
   - ✅ PI events: Associated via bindings
   - ❌ OPC UA events: Not associated
   - ❌ Modbus events: Not associated
   - ❌ MQTT events: Not associated
   - ❌ Database events: Not associated

3. **Real-Time Filtering:**
   - ✅ Frontend filters on selection change
   - ⚠️ Real-time events might not be filtered correctly
   - ⚠️ WebSocket subscriptions need hierarchy filtering

---

## 🔧 **RECOMMENDED SOLUTION**

### **Phase 1: Universal Binding System**

**1. Create Unified Binding Entity:**
```typescript
SourceBinding {
  id: UUID
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI'
  sourceConnectionId: UUID  // Connection ID
  sourceIdentifier: string  // WebId, NodeId, Topic, Register, etc.
  boundType: 'unit' | 'asset'
  boundId: UUID  // Unit ID or Asset ID
  tenantId: string
  organizationId?: string
  isActive: boolean
}
```

**2. Binding Service:**
```typescript
class SourceBindingService {
  async createBinding(binding: CreateBindingDto)
  async findBinding(sourceType, sourceIdentifier, tenantId)
  async getBindingsForHierarchy(unitId?, assetId?, tenantId?)
  async deleteBinding(id)
}
```

**3. Update Event Pulling:**
- All event pull services use binding service
- Events always tagged with hierarchy IDs
- Missing bindings logged as warnings

---

### **Phase 2: Real-Time Filtering**

**1. Backend API Enhancement:**
```typescript
// Support hierarchy filtering
GET /api/production-events?tenantId=X&unitId=Y&assetId=Z

// WebSocket subscription with filters
socket.emit('subscribe-events', {
  tenantId: "...",
  unitId: "...",
  assetId: "..."
});
```

**2. Frontend Updates:**
```typescript
// Listen to selection changes
useEffect(() => {
  // Unsubscribe old
  socket.emit('unsubscribe-events', oldFilters);
  
  // Subscribe new
  socket.emit('subscribe-events', {
    tenantId: plantSelection?.tenant?.id,
    unitId: plantSelection?.unit?.id,
    assetId: plantSelection?.asset?.id,
  });
}, [plantSelection]);

// Handle incoming events
socket.on('new-event', (event) => {
  // Event already filtered by backend
  // Just add to local state
  setEvents(prev => [...prev, event]);
});
```

**3. Backend WebSocket Filtering:**
```typescript
// When event created, check if matches any subscriptions
const subscriptions = getSubscriptions(event.tenantId);
for (const sub of subscriptions) {
  if (matchesFilters(event, sub.filters)) {
    sub.socket.emit('new-event', event);
  }
}
```

---

### **Phase 3: Binding Configuration UI**

**1. Extend Binding Manager:**
- Support all source types
- Discovery for each source type
- Visual binding interface

**2. Auto-Discovery:**
- OPC UA: Browse nodes
- Modbus: List registers
- MQTT: List topics
- Database: List tables/columns

**3. Batch Binding:**
- Map multiple sources at once
- Import/export bindings
- Template-based binding

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Backend Tasks:**

- [ ] Create unified `SourceBinding` entity (extends current AF Binding)
- [ ] Create `SourceBindingService` with CRUD operations
- [ ] Update `UnifiedEventPullService` to use bindings
- [ ] Update OPC UA event pull to associate with hierarchy
- [ ] Update Modbus event pull to associate with hierarchy
- [ ] Update MQTT event pull to associate with hierarchy
- [ ] Update Database event pull to associate with hierarchy
- [ ] Update REST API event pull to associate with hierarchy
- [ ] Add hierarchy filtering to event endpoints
- [ ] Add WebSocket filtering by hierarchy

### **Frontend Tasks:**

- [ ] Extend `BindingManager` for all source types
- [ ] Create binding discovery for each source type
- [ ] Update event pulling to use hierarchy context
- [ ] Update WebSocket subscriptions to filter by hierarchy
- [ ] Add real-time event filtering on selection change
- [ ] Update all modules to use hierarchy filtering

### **Testing Tasks:**

- [ ] Test PI event association
- [ ] Test OPC UA event association
- [ ] Test Modbus event association
- [ ] Test MQTT event association
- [ ] Test hierarchy filtering
- [ ] Test real-time updates
- [ ] Test selection changes

---

## 🎯 **KEY DECISIONS NEEDED**

### **1. Binding Strategy:**

**Option A: Separate bindings per source type**
- Pros: Clear separation, source-specific logic
- Cons: More entities, complex management

**Option B: Unified binding table**
- Pros: Single interface, easier management
- Cons: More complex queries, source-specific fields

**Recommendation:** Option B (Unified)

---

### **2. Event Association Timing:**

**Option A: At pull time**
- Events associated when pulled
- Bindings required before pulling

**Option B: At creation time (real-time)**
- Events associated when created
- Can create bindings later and retroactively update

**Option C: Lazy association**
- Events stored with source identifiers
- Association done on-demand during filtering

**Recommendation:** Option A + B (Pull time for batch, real-time for streams)

---

### **3. Filtering Strategy:**

**Option A: Backend filtering**
- Backend filters events by hierarchy
- Frontend receives only filtered events
- Pros: Efficient, secure
- Cons: More backend logic

**Option B: Frontend filtering**
- Backend sends all events
- Frontend filters client-side
- Pros: Simple, flexible
- Cons: Inefficient, more data transfer

**Option C: Hybrid**
- Backend pre-filters by tenant
- Frontend filters by unit/asset
- Pros: Balanced
- Cons: Two-step process

**Recommendation:** Option A (Backend filtering)

---

## 🚀 **NEXT STEPS**

1. **Review this analysis** ✅
2. **Decide on binding strategy**
3. **Design unified binding entity**
4. **Implement binding service**
5. **Update event pulling services**
6. **Add hierarchy filtering to APIs**
7. **Update frontend for real-time filtering**

---

**Status:** 📋 Analysis Complete - Awaiting Implementation Decision

