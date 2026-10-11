# 📡 PI Event Pulling Architecture - Backend Integration

## Overview

This document describes how events are pulled from PI (Plant Information) systems and other external sources through the **backend API**, replacing the previous direct frontend-to-PI integration.

---

## 🏗️ Architecture Change

### **Before (Direct Integration):**
```
Frontend (Browser)
    ↓ (Direct HTTP calls with credentials)
PI Web API / External Sources
```

**Issues:**
- ❌ Credentials stored in frontend (security risk)
- ❌ CORS issues
- ❌ No centralized event storage
- ❌ No server-side transformation
- ❌ Difficult to monitor and audit

### **After (Backend Integration):**
```
Frontend (Browser)
    ↓ (API calls with JWT)
Backend API Server
    ↓ (Uses stored credentials)
PI Web API / External Sources
    ↓
Database (PI Events stored)
```

**Benefits:**
- ✅ Credentials stored securely in backend database
- ✅ No CORS issues (backend handles external calls)
- ✅ Centralized event storage and management
- ✅ Server-side transformation and mapping
- ✅ Full audit trail and monitoring
- ✅ Easier to scale and maintain

---

## 🔌 Backend Endpoints

### 1. **Pull Events from PI**

**Endpoint:** `POST /api/integration/pi/pull-events`

**Authentication:** JWT Bearer token required

**Request Body:**
```typescript
{
  tenantId: string;                    // Required: Tenant ID
  startTimeUtc?: string;               // Optional: ISO 8601 UTC (default: 1 hour ago)
  endTimeUtc?: string;                 // Optional: ISO 8601 UTC (default: now)
  scopeType?: 'database' | 'element';  // Optional: Scope type
  scopeId?: string;                    // Optional: Database/Element WebId
  templateName?: string;               // Optional: Filter by template name
  maxCount?: number;                   // Optional: Max events (default: 200)
  autoCreateProductionEvents?: boolean;// Optional: Create production events (default: true)
}
```

**Response:**
```typescript
{
  success: boolean;
  eventsFetched: number;              // Number of events fetched from PI
  eventsStored: number;               // Number of events stored in database
  productionEventsCreated: number;    // Number of production events created
  errors: string[];                   // Any errors encountered
  events: PIEvent[];                  // Array of stored PI events
}
```

**Example Request:**
```bash
curl -X POST http://localhost:4004/api/integration/pi/pull-events \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "startTimeUtc": "2025-01-15T00:00:00Z",
    "endTimeUtc": "2025-01-15T23:59:59Z",
    "scopeType": "database",
    "scopeId": "database-webid-123",
    "templateName": "Production Loss",
    "maxCount": 500,
    "autoCreateProductionEvents": true
  }'
```

### 2. **Test PI Connection**

**Endpoint:** `GET /api/integration/pi/test-connection?tenantId=<tenantId>`

**Authentication:** JWT Bearer token required

**Response:**
```typescript
{
  connected: boolean;
  message: string;
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4004/api/integration/pi/test-connection?tenantId=tenant-123" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 🔐 Credential Management

### **PI Connection Configuration**

PI connection credentials are stored in the `pi_connections` table:

- **Connection Name**: User-friendly name for the connection
- **PI Web API URL**: Base URL of PI Web API server
- **Username**: PI server username
- **Password Encrypted**: Encrypted password (stored securely)
- **AF Database Path**: Optional database path
- **Connection Config**: JSON configuration (database/element WebIds, etc.)
- **Tenant ID**: Multi-tenant isolation

**Security:**
- Passwords are stored encrypted in the database
- Frontend never sees or handles credentials
- Backend retrieves and uses credentials server-side only

### **Managing Connections**

Use existing endpoints:
- `POST /api/pi-connections` - Create connection
- `GET /api/pi-connections?tenantId=xxx` - List connections
- `PATCH /api/pi-connections/:id` - Update connection
- `DELETE /api/pi-connections/:id` - Delete connection

---

## 🔄 Event Pulling Process

### **Step-by-Step Flow:**

1. **Frontend Request:**
   - Frontend calls `POST /api/integration/pi/pull-events` with tenant ID and time range
   - No credentials needed - backend handles authentication

2. **Backend Processing:**
   - Backend retrieves PI connection config for tenant from database
   - Uses stored credentials to connect to PI Web API
   - Fetches event frames from PI based on parameters
   - Stores events in `pi_events` table
   - Optionally creates `production_events` from PI events using mappings

3. **Event Transformation:**
   - Uses `pi_mappings` to map PI templates to production event types
   - Uses `af_bindings` to map PI elements to units/assets
   - Applies transformation rules to create production events

4. **Response:**
   - Backend returns summary and stored events
   - Frontend can then query `production_events` or `pi_events` endpoints

---

## 📊 Data Flow

### **PI Event Storage:**

```
PI Web API Event Frame
    ↓ (pulled by backend)
PI Event Entity (pi_events table)
    - webId: PI event frame WebId
    - template: Template name
    - name: Event name
    - startUtc/endUtc: Time range
    - primaryAfId: Associated AF element
    - eventData: Full JSON payload
    - tenantId: Multi-tenant isolation
```

### **Production Event Creation:**

```
PI Event
    ↓ (with mappings & bindings)
Production Event Entity (production_events table)
    - eventId: PI WebId reference
    - eventType: Mapped from template
    - unitId/assetId: Mapped from bindings
    - source: 'Simulated PI'
    - All production event fields
```

---

## 🎯 Frontend Integration Guide

### **Replacing Direct PI Calls:**

**Before (Direct):**
```typescript
// ❌ OLD: Direct PI API call
const client = new PIClient({
  basePath: '/piwebapi',
  authProvider: async () => basicAuthHeader(username, password)
});

const events = await client.getEventFrames({
  databaseWebId: dbWebId,
  startTimeUtc: startTime,
  endTimeUtc: endTime,
  maxCount: 200
});
```

**After (Backend API):**
```typescript
// ✅ NEW: Backend API call
import { httpClient } from '@/services/api/httpClient';

const response = await httpClient.post('/integration/pi/pull-events', {
  tenantId: session.tenant.id,
  startTimeUtc: startTime,
  endTimeUtc: endTime,
  scopeType: 'database',
  scopeId: dbWebId,
  maxCount: 200,
  autoCreateProductionEvents: true
});

// Events are now in database - query them via API
const piEvents = await httpClient.get('/pi-events', {
  params: { tenantId: session.tenant.id }
});

// Or query production events
const productionEvents = await httpClient.get('/production-events', {
  params: { tenantId: session.tenant.id, source: 'Simulated PI' }
});
```

### **Frontend Services to Update:**

1. **`AutoPIEventSyncService`** - Update to call backend endpoint
2. **`PISyncService`** - Update to use backend for syncing
3. **`PIIntegration.tsx`** - Update UI to use backend endpoints
4. **`PIStore`** - Keep for connection config management (now stored in backend)

---

## 🔄 Migration Strategy

### **Phase 1: Backend Implementation (✅ Complete)**
- ✅ Backend service for pulling events
- ✅ Endpoints for event operations
- ✅ Database entities and storage

### **Phase 2: Frontend Update (Next)**
- Update `AutoPIEventSyncService` to call backend
- Update `PISyncService` to use backend endpoints
- Update UI components to use new endpoints
- Remove direct PI API calls from frontend

### **Phase 3: Cleanup**
- Remove `PIClient` direct usage from frontend
- Remove credential storage from frontend IndexedDB
- Update documentation

---

## 📝 Example Usage

### **Frontend Service Update:**

```typescript
// services/pi/AutoPIEventSyncService.ts
class AutoPIEventSyncService {
  async runSync(tenantId: string): Promise<SyncResult> {
    // Get sync job config
    const jobConfig = await this.getSyncJobConfig(tenantId);
    const lookbackMinutes = jobConfig?.lookbackMinutes || 60;
    
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
    
    // Call backend endpoint instead of direct PI API
    const response = await httpClient.post('/integration/pi/pull-events', {
      tenantId,
      startTimeUtc: startTime,
      endTimeUtc: endTime,
      maxCount: 200,
      autoCreateProductionEvents: true
    });
    
    return {
      success: response.success,
      eventsFetched: response.eventsFetched,
      eventsCreated: response.productionEventsCreated,
      eventsUpdated: 0, // Backend handles this
      errors: response.errors,
      duration: 0,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## 🚀 Benefits Summary

1. **Security:**
   - Credentials stored securely in backend database
   - Frontend never handles credentials
   - JWT authentication for all API calls

2. **Reliability:**
   - Centralized error handling and retry logic
   - Event storage for offline access
   - Audit trail for all operations

3. **Scalability:**
   - Backend can handle multiple concurrent syncs
   - Rate limiting and throttling
   - Better resource management

4. **Maintainability:**
   - Single source of truth for PI integration
   - Easier to update and extend
   - Better logging and monitoring

---

## 📚 Related Documentation

- `server/pro-act-backend/src/integration/pi-event-pull.service.ts` - Service implementation
- `server/pro-act-backend/src/integration/integration.controller.ts` - Controller endpoints
- `server/pro-act-backend/src/pi-connection/` - Connection management
- `server/pro-act-backend/src/pi-event/` - PI event storage

---

**Status:** ✅ Backend Implementation Complete
**Next:** Update frontend to use backend endpoints

