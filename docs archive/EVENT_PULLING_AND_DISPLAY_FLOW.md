# 📡 Event Pulling and Display Flow - Complete Architecture

## Overview

This document explains how events are pulled from external sources (PI, OPC UA, Modbus, MQTT, etc.) through the backend and displayed in the frontend EventHub.

---

## 🏗️ Complete Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SOURCES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ PI System│  │ OPC UA   │  │ Modbus   │  │  MQTT    │  ...   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API SERVER                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         UnifiedEventPullService                         │    │
│  │  - Routes requests to appropriate source handler        │    │
│  │  - Supports: PI, OPC UA, Modbus, MQTT, Database, REST  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         PIEventPullService (for PI)                     │    │
│  │  1. Retrieves PI connection config from database       │    │
│  │  2. Connects to PI Web API using stored credentials    │    │
│  │  3. Fetches event frames based on time range/filters    │    │
│  │  4. Stores events in pi_events table                   │    │
│  │  5. Applies mappings to create production_events       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Database Storage                            │    │
│  │  - pi_events: Raw PI event frames                       │    │
│  │  - production_events: Transformed production events     │    │
│  │  - pi_mappings: Template → Event type mappings          │    │
│  │  - af_bindings: PI elements → Units/Assets mappings     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         RealtimeGateway (WebSocket)                      │    │
│  │  - Broadcasts new events to connected clients            │    │
│  │  - Events: productionEventCreated, productionEventUpdated│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         EventPullService                                 │    │
│  │  - Calls backend API to pull events                       │    │
│  │  - POST /api/connectivity/events/pull                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         EventHub.tsx (Main UI Component)                 │    │
│  │  1. loadData() - Fetches events from backend             │    │
│  │  2. masterDataService.getProductionEvents()              │    │
│  │  3. Displays events in filtered table/list               │    │
│  │  4. Real-time updates via WebSocket (optional)           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Step-by-Step Event Flow

### **Step 1: Frontend Initiates Event Pull**

**Location:** `src/services/EventPullService.ts`

```typescript
// Frontend calls backend to pull events from PI
const response = await eventPullService.pullFromPI(tenantId, {
  startTimeUtc: '2025-01-15T00:00:00Z',
  endTimeUtc: '2025-01-15T23:59:59Z',
  scopeType: 'database',
  scopeId: 'database-webid-123',
  templateName: 'Production Loss',
  maxCount: 500,
  autoCreateProductionEvents: true
});
```

**API Call:**
```http
POST /api/connectivity/events/pull
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "sourceType": "PI",
  "sourceId": "pi-connection-id",
  "tenantId": "tenant-123",
  "startTimeUtc": "2025-01-15T00:00:00Z",
  "endTimeUtc": "2025-01-15T23:59:59Z",
  "filters": {
    "scopeType": "database",
    "scopeId": "database-webid-123",
    "templateName": "Production Loss"
  },
  "maxCount": 500,
  "autoCreateProductionEvents": true
}
```

---

### **Step 2: Backend Routes Request**

**Location:** `server/pro-act-backend/src/connectivity/services/unified-event-pull.service.ts`

```typescript
async pullEvents(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
  switch (request.sourceType) {
    case 'PI':
      return await this.pullEventsFromPI(request);
    case 'OPCUA':
      return await this.pullEventsFromOPCUA(request);
    case 'Modbus':
      return await this.pullEventsFromModbus(request);
    // ... other sources
  }
}
```

---

### **Step 3: Backend Pulls Events from PI**

**Location:** `server/pro-act-backend/src/integration/pi-event-pull.service.ts`

**Process:**
1. **Retrieve PI Connection:**
   ```typescript
   const connection = await this.piConnectionRepository.findOne({
     where: { tenantId: request.tenantId, isActive: true }
   });
   ```

2. **Build PI Web API Request:**
   ```typescript
   const eventFramesUrl = `${apiBase}/assetdatabases/${scopeId}/eventframes?${queryParams}`;
   ```

3. **Fetch Event Frames:**
   ```typescript
   const response = await axios.get(eventFramesUrl, {
     auth: { username: connection.username, password: password }
   });
   const eventFrames = response.data?.Items || [];
   ```

4. **Store Events in Database:**
   ```typescript
   // Store in pi_events table
   const piEvent = await this.piEventRepository.save({
     webId: ef.WebId,
     tenantId: request.tenantId,
     template: ef.TemplateName,
     name: ef.Name,
     startUtc: ef.StartTime,
     endUtc: ef.EndTime,
     eventData: JSON.stringify(ef)
   });
   ```

5. **Create Production Events (if autoCreateProductionEvents = true):**
   ```typescript
   // Apply mappings and bindings
   const mapping = mappingMap.get(ef.TemplateName);
   const binding = bindingMap.get(ef.PrimaryReferencedElement?.WebId);
   
   // Create production event
   const productionEvent = await this.productionEventService.create({
     eventId: ef.WebId,
     eventType: mapping?.targetEventType || 'ProductionLoss',
     unitId: binding?.unitId,
     assetId: binding?.assetId,
     source: 'Simulated PI',
     // ... other mapped fields
   });
   ```

---

### **Step 4: Backend Returns Response**

**Response Structure:**
```typescript
{
  success: true,
  sourceType: "PI",
  sourceId: "pi-connection-id",
  eventsFetched: 150,
  eventsStored: 150,
  productionEventsCreated: 145,
  errors: [],
  events: [...], // Array of stored PI events
  metadata: {
    scopeType: "database",
    templateName: "Production Loss"
  }
}
```

---

### **Step 5: Frontend Displays Events**

**Location:** `src/pages/EventHub.tsx`

**Event Loading:**
```typescript
const loadData = async () => {
  const tenantId = plantSelection?.tenant?.id || session.tenant?.id;
  
  // Fetch production events from backend
  const eventsData = await masterDataService.getProductionEvents({ tenantId });
  
  setEvents(eventsData);
};

// Called on component mount and when tenant changes
useEffect(() => {
  loadData();
}, [session, plantSelection?.tenant?.id]);
```

**API Call:**
```http
GET /api/production-events?tenantId=tenant-123
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```typescript
[
  {
    id: "event-123",
    eventId: "PI-WebId-456",
    eventType: "ProductionLoss",
    unitId: "unit-789",
    assetId: "asset-012",
    startTime: "2025-01-15T10:00:00Z",
    endTime: "2025-01-15T10:30:00Z",
    source: "Simulated PI",
    status: "Open",
    // ... other fields
  },
  // ... more events
]
```

**Display in UI:**
- Events are filtered by `activeTab` (ProductionLoss, IOW, SOL, APM, etc.)
- Filtered by status, unit, asset, date range, etc.
- Displayed in a table/card list with details
- Clicking an event shows full details and allows editing

---

## 🔌 Backend Endpoints

### **1. Pull Events from Any Source**

**Endpoint:** `POST /api/connectivity/events/pull`

**Request:**
```typescript
{
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI',
  sourceId: string,
  tenantId: string,
  startTimeUtc?: string,
  endTimeUtc?: string,
  filters?: Record<string, any>,
  maxCount?: number,
  autoCreateProductionEvents?: boolean
}
```

**Response:**
```typescript
{
  success: boolean,
  sourceType: string,
  sourceId: string,
  eventsFetched: number,
  eventsStored: number,
  productionEventsCreated: number,
  errors: string[],
  events: any[],
  metadata?: Record<string, any>
}
```

### **2. Get Available Event Sources**

**Endpoint:** `GET /api/connectivity/events/sources?tenantId=<tenantId>`

**Response:**
```typescript
[
  {
    type: "PI",
    id: "pi-connection-id",
    name: "PI Production System",
    description: "Main PI system connection",
    enabled: true,
    sourceType: "PI"
  },
  // ... more sources
]
```

### **3. Get Production Events**

**Endpoint:** `GET /api/production-events?tenantId=<tenantId>&unitId=<unitId>&status=<status>`

**Response:**
```typescript
ProductionEvent[] // Array of production events
```

---

## 📊 Data Transformation

### **PI Event → Production Event Mapping**

**Mappings Table (`pi_mappings`):**
- Maps PI template names to production event types
- Example: `"Production Loss Template"` → `"ProductionLoss"`

**Bindings Table (`af_bindings`):**
- Maps PI element WebIds to Units/Assets
- Example: `"PI-Element-123"` → `unitId: "unit-456"`

**Transformation Process:**
```typescript
// 1. Get mapping for template
const mapping = mappings.find(m => m.sourceId === ef.TemplateName);

// 2. Get binding for element
const binding = bindings.find(b => b.webId === ef.PrimaryReferencedElement?.WebId);

// 3. Create production event
const productionEvent = {
  eventId: ef.WebId,
  eventType: mapping?.targetEventType || 'ProductionLoss',
  unitId: binding?.unitId,
  assetId: binding?.assetId,
  startTime: ef.StartTime,
  endTime: ef.EndTime,
  source: 'Simulated PI',
  // Extract attributes from PI event frame
  description: ef.Attributes?.find(a => a.Name === 'Description')?.Value,
  // ... other mapped fields
};
```

---

## 🔄 Real-Time Updates (WebSocket)

**Backend:** `server/pro-act-backend/src/realtime.gateway.ts`

When a new production event is created:
```typescript
// Backend broadcasts to all connected clients
this.realtimeGateway.broadcastProductionEventCreated(productionEvent);
```

**Frontend:** (Optional - can be implemented)
```typescript
// Connect to WebSocket
const socket = io('http://localhost:4004');

// Listen for new events
socket.on('productionEventCreated', (event) => {
  // Add to events list
  setEvents(prev => [event, ...prev]);
});
```

---

## 🎯 Frontend Integration Points

### **1. EventHub Component**

**File:** `src/pages/EventHub.tsx`

**Key Functions:**
- `loadData()` - Fetches events from backend API
- `masterDataService.getProductionEvents()` - API call to get events
- Event filtering and display
- Event creation/editing/deletion

### **2. EventPullService**

**File:** `src/services/EventPullService.ts`

**Key Functions:**
- `pullFromPI()` - Pull events from PI system via backend
- `pullFromSource()` - Pull from any configured source
- `getAvailableSources()` - Get list of available event sources

### **3. Connectivity API**

**File:** `src/services/api/connectivityApi.ts`

**Key Functions:**
- `pullEvents()` - Call backend to pull events
- `getEventSources()` - Get available sources

---

## 📝 Example: Complete Flow

### **Scenario: Pull Events from PI and Display**

1. **User clicks "Pull Events" button in UI**
   ```typescript
   // In EventHub or PI Integration page
   const handlePullEvents = async () => {
     const response = await eventPullService.pullFromPI(tenantId, {
       startTimeUtc: oneHourAgo,
       endTimeUtc: now,
       maxCount: 500
     });
     
     toast({
       title: 'Success',
       description: `Pulled ${response.eventsFetched} events, created ${response.productionEventsCreated} production events`
     });
     
     // Refresh events list
     loadData();
   };
   ```

2. **Backend processes request**
   - Connects to PI Web API
   - Fetches event frames
   - Stores in `pi_events` table
   - Creates `production_events` using mappings

3. **Frontend displays events**
   - `loadData()` fetches production events
   - Events displayed in EventHub table
   - Filtered by type, status, unit, etc.

---

## 🔐 Security & Credentials

- **PI credentials stored in backend database** (`pi_connections` table)
- **Frontend never sees credentials** - all PI API calls happen server-side
- **JWT authentication** required for all API calls
- **Multi-tenant isolation** - events filtered by `tenantId`

---

## 🚀 Benefits

1. **Security:** Credentials never exposed to frontend
2. **Centralized Storage:** All events stored in database
3. **Transformation:** Server-side mapping and transformation
4. **Scalability:** Backend can handle multiple concurrent pulls
5. **Audit Trail:** All operations logged
6. **Offline Access:** Events available even when PI system is down

---

## 📚 Related Files

**Backend:**
- `server/pro-act-backend/src/integration/pi-event-pull.service.ts` - PI event pulling
- `server/pro-act-backend/src/connectivity/services/unified-event-pull.service.ts` - Unified pulling
- `server/pro-act-backend/src/realtime.gateway.ts` - WebSocket gateway
- `server/pro-act-backend/src/connectivity/connectivity.controller.ts` - API endpoints

**Frontend:**
- `src/services/EventPullService.ts` - Event pulling service
- `src/services/api/connectivityApi.ts` - Connectivity API client
- `src/pages/EventHub.tsx` - Main event display component
- `src/services/MasterDataService.ts` - Production event API calls

---

**Status:** ✅ Fully Integrated - Events can be pulled from PI and other sources via backend and displayed in frontend

