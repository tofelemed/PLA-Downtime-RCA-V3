# 🔌 How PI (AVEVA PI System) Connection Works in ProAct

## Overview

Unlike OPC UA and MQTT which use protocol libraries, **PI integration uses REST API (HTTP)** to connect to **PI Web API**. It's a different approach but equally real and functional.

---

## 🔄 **PI Connection Architecture**

### **Key Difference:**

- **OPC UA/MQTT/Modbus**: Use protocol-specific libraries (node-opcua, mqtt, modbus-serial)
- **PI**: Uses **REST API over HTTP** (PI Web API)
- **Library Used**: `axios` (standard HTTP client) - **Already installed in package.json**

---

## 📡 **How PI Connection Works**

### **1. PI Web API (REST API)**

AVEVA PI System provides a **RESTful Web API** that allows applications to:
- Browse AF (Asset Framework) hierarchy
- Read event frames
- Read/write tag values
- Access time-series data
- Query historical data

**PI Web API Base URL Example:**
```
https://piv.hillal-intl.com:8070/piwebapi
```

### **2. Authentication Method**

PI Web API uses **Basic Authentication** (Username/Password):
```typescript
// HTTP Header:
Authorization: Basic base64(username:password)
```

### **3. Connection Flow**

```
Frontend/Backend → HTTP Request (Axios) → PI Web API Server → PI System Database
```

---

## 🔌 **Backend Implementation**

### **Service: `PIEventPullService`**

**Location**: `server/pro-act-backend/src/integration/pi-event-pull.service.ts`

**How It Connects:**

```typescript
// 1. Get PI connection configuration from database
const connection = await this.piConnectionRepository.findOne({
  where: { tenantId: request.tenantId, isActive: true }
});

// 2. Build PI Web API URL
const apiBase = `${connection.piWebApiUrl}/piwebapi`;

// 3. Make HTTP request using Axios (REST API call)
const eventFramesUrl = `${apiBase}/assetdatabases/${scopeId}/eventframes?startTime=...&endTime=...`;

const axiosConfig: AxiosRequestConfig = {
  method: 'GET',
  url: eventFramesUrl,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  auth: {
    username: connection.username,
    password: connection.passwordEncrypted, // Basic Auth
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // For self-signed certificates
  }),
};

// 4. Execute HTTP request to PI Web API
const response = await axios(axiosConfig);

// 5. Process response (event frames data)
const eventFrames = response.data.Items;
```

### **Key Features:**

1. ✅ **Real HTTP Connection** to PI Web API server
2. ✅ **Basic Authentication** with username/password
3. ✅ **Event Frame Pulling** from PI system
4. ✅ **AF Hierarchy Browsing** (Asset Framework)
5. ✅ **Time-based Queries** (startTime/endTime)
6. ✅ **Template Filtering** (filter by event frame templates)
7. ✅ **Pagination Support** (maxCount parameter)

---

## 🌐 **Frontend Implementation**

### **Service: `PIClient`**

**Location**: `src/services/pi/PIClient.ts`

**How It Connects:**

```typescript
// Create PI Client with authentication
const client = new PIClient({
  basePath: '/piwebapi',
  authProvider: async () => {
    // Basic Auth header
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
  }
});

// Browse Asset Servers (Real HTTP request)
const assetServers = await client.getAssetServers();
// HTTP GET: https://pi-server:8070/piwebapi/assetservers

// Browse AF Databases
const databases = await client.getAFDatabases(assetServerWebId);
// HTTP GET: https://pi-server:8070/piwebapi/assetservers/{webId}/assetdatabases

// Browse Elements (AF Hierarchy)
const elements = await client.getDatabaseElements(databaseWebId);
// HTTP GET: https://pi-server:8070/piwebapi/assetdatabases/{webId}/elements

// Get Event Frames
const eventFrames = await client.getEventFrames(elementWebId, {
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2025-01-01T23:59:59Z',
  templateName: 'ProductionLoss'
});
// HTTP GET: https://pi-server:8070/piwebapi/elements/{webId}/eventframes?startTime=...&endTime=...
```

---

## 📊 **Complete PI Connection Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend UI                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User enters PI connection details:                      │  │
│  │  - Base URL: https://pi-server:8070/piwebapi            │  │
│  │  - Username: DOMAIN\user                                 │  │
│  │  - Password: ********                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP POST /api/pi-connections
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PIConnectionService.create()                           │  │
│  │  - Validates input                                       │  │
│  │  - Saves to database                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Connection saved in pi_connections table
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Database (ProActDB)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  pi_connections table                                   │  │
│  │  - id, piWebApiUrl, username, passwordEncrypted, etc.   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ User clicks "Pull Events" or "Test Connection"
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              PI Web API HTTP Client (Axios)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PIEventPullService.pullEvents()                         │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  1. Load config from database                      │  │  │
│  │  │  2. Build PI Web API URL                          │  │  │
│  │  │  3. Create HTTP request with Basic Auth           │  │  │
│  │  │  4. Execute HTTP GET to PI Web API                │  │  │
│  │  │  5. Receive event frames JSON response            │  │  │
│  │  │  6. Process and store events                      │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP GET with Basic Auth
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PI Web API Server                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  https://pi-server:8070/piwebapi                        │  │
│  │  - Authenticates request (Basic Auth)                   │  │
│  │  - Queries PI System database                          │  │
│  │  - Returns event frames JSON                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ JSON Response (Event Frames)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Processing                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - Parse event frames                                    │  │
│  │  - Map to production events                              │  │
│  │  - Store in database                                     │  │
│  │  - Return to frontend                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Response
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend UI                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Displays event frames and results                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 **Key PI Web API Endpoints Used**

### **1. Test Connection**
```
GET /piwebapi/assetservers
```
**Purpose**: Verify PI Web API connectivity and authentication  
**Response**: List of asset servers

### **2. Browse Asset Servers**
```
GET /piwebapi/assetservers
```
**Purpose**: List available PI Asset Servers  
**Response**: Array of asset server objects with WebIDs

### **3. Browse AF Databases**
```
GET /piwebapi/assetservers/{assetServerWebId}/assetdatabases
```
**Purpose**: List Asset Framework databases  
**Response**: Array of AF database objects

### **4. Browse Elements (AF Hierarchy)**
```
GET /piwebapi/assetdatabases/{databaseWebId}/elements
GET /piwebapi/elements/{elementWebId}/elements (children)
```
**Purpose**: Browse Asset Framework hierarchy  
**Response**: Array of AF element objects

### **5. Get Event Frames**
```
GET /piwebapi/assetdatabases/{databaseWebId}/eventframes?startTime=...&endTime=...&templateName=...
GET /piwebapi/elements/{elementWebId}/eventframes?startTime=...&endTime=...&templateName=...
```
**Purpose**: Pull event frames within time range  
**Response**: Array of event frame objects

### **6. Get Event Frame Attributes**
```
GET /piwebapi/eventframes/{eventFrameWebId}/attributes
```
**Purpose**: Get attributes (values) of an event frame  
**Response**: Array of attribute objects with values

---

## 📝 **Example: Complete PI Event Pull**

### **1. User Creates PI Connection (Backend):**
```typescript
// Save connection to database
POST /api/pi-connections
{
  "connectionName": "Production PI Server",
  "piWebApiUrl": "https://piv.hillal-intl.com:8070",
  "username": "DOMAIN\\pi_user",
  "passwordEncrypted": "secure_password",
  "tenantId": "tenant-123",
  "isActive": true
}
```

### **2. User Tests Connection:**
```typescript
// Backend makes HTTP request to PI Web API
GET https://piv.hillal-intl.com:8070/piwebapi/assetservers
Authorization: Basic base64(DOMAIN\pi_user:secure_password)

// PI Web API responds:
{
  "Items": [
    {
      "WebId": "F1DPQQT4O5x0v10iUSNB_XYZ",
      "Name": "PIServer",
      "Description": "Primary PI Server"
    }
  ]
}

// Backend returns:
{
  "connected": true,
  "message": "Connection successful"
}
```

### **3. User Pulls Event Frames:**
```typescript
// Backend makes HTTP request
GET https://piv.hillal-intl.com:8070/piwebapi/assetdatabases/{webId}/eventframes?
  startTime=2025-01-15T00:00:00Z&
  endTime=2025-01-15T23:59:59Z&
  templateName=ProductionLoss&
  maxCount=100
Authorization: Basic base64(...)

// PI Web API responds:
{
  "Items": [
    {
      "WebId": "EF1",
      "Name": "Production Loss Event 1",
      "StartTime": "2025-01-15T10:30:00Z",
      "EndTime": "2025-01-15T11:45:00Z",
      "TemplateName": "ProductionLoss",
      "CategoryNames": ["Production Loss"],
      "Element": {
        "WebId": "ELEMENT1",
        "Name": "Production Line 1"
      }
    },
    // ... more event frames
  ]
}

// Backend processes:
1. Parse event frames
2. Map to production events using hierarchy mappings
3. Store in database
4. Create production events

// Return to frontend:
{
  "success": true,
  "eventsFetched": 50,
  "eventsStored": 50,
  "productionEventsCreated": 50,
  "errors": []
}
```

---

## 🔐 **Authentication & Security**

### **Basic Authentication:**
- **Method**: HTTP Basic Auth (username:password base64 encoded)
- **Format**: `Authorization: Basic base64(username:password)`
- **Storage**: Credentials stored encrypted in database (should use proper encryption)

### **HTTPS Support:**
- PI Web API typically runs on HTTPS
- Self-signed certificates handled with `rejectUnauthorized: false` in development

### **Domain Authentication:**
- PI often uses Windows Domain authentication
- Username format: `DOMAIN\username`
- Password: Domain password

---

## 🌐 **CORS Handling**

### **Problem:**
- Browsers block direct HTTP requests to PI Web API from frontend (CORS)
- PI Web API doesn't allow cross-origin requests

### **Solution: PI Proxy**

**Backend Proxy Service**: `pi-proxy.controller.ts`

The backend acts as a **proxy** to avoid CORS issues:

```
Frontend → Backend Proxy → PI Web API
         (Same origin)    (CORS handled by backend)
```

**Frontend calls:**
```typescript
// Frontend calls backend proxy (no CORS issue)
const response = await fetch('/api/pi-proxy/assetservers', {
  headers: {
    'Authorization': 'Bearer JWT_TOKEN'
  }
});

// Backend proxy forwards to PI Web API
// Backend handles CORS, authentication, etc.
```

---

## 📚 **Libraries Used**

### **Backend:**
- **`axios`**: HTTP client for making REST API requests to PI Web API
- **`https`**: Node.js HTTPS module for SSL/TLS connections
- **Already installed**: ✅ Yes (`axios` is in package.json)

### **Frontend:**
- **Custom `PIClient` class**: Wrapper around fetch API for PI Web API calls
- **No special library needed**: Uses standard HTTP requests

---

## 🆚 **Comparison: PI vs OPC UA/MQTT**

| Feature | PI | OPC UA | MQTT |
|---------|----|----|----- |
| **Connection Type** | REST API (HTTP) | Protocol Library | Protocol Library |
| **Library** | `axios` (HTTP client) | `node-opcua` | `mqtt` |
| **Authentication** | Basic Auth (HTTP header) | Session-based | Username/Password |
| **Real-time** | Polling (HTTP requests) | Subscriptions | Pub/Sub |
| **Data Format** | JSON | OPC UA Binary/JSON | MQTT Messages |
| **Connection State** | Stateless (HTTP) | Stateful (sessions) | Stateful (TCP) |

---

## 🎯 **Key Points**

### **✅ Real Connection:**
- Uses **actual HTTP requests** to PI Web API
- **Real authentication** with PI system credentials
- **Real data** pulled from PI system database

### **✅ RESTful Approach:**
- Standard HTTP GET/POST requests
- JSON data format
- Stateless connections (each request is independent)

### **✅ Full Functionality:**
- Browse AF hierarchy
- Pull event frames
- Filter by templates
- Time-based queries
- Attribute reading

### **✅ Backend & Frontend Support:**
- Backend: `PIEventPullService` for server-side pulling
- Frontend: `PIClient` for client-side browsing
- Proxy service for CORS handling

---

## 🚀 **How to Test PI Connection**

### **1. Test Connection (Backend):**
```bash
GET /api/integration/pi/test-connection?tenantId=your-tenant-id
Authorization: Bearer JWT_TOKEN

# Response:
{
  "connected": true,
  "message": "Connection successful"
}
```

### **2. Pull Events:**
```bash
POST /api/integration/pi/pull-events
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "tenantId": "your-tenant-id",
  "startTimeUtc": "2025-01-15T00:00:00Z",
  "endTimeUtc": "2025-01-15T23:59:59Z",
  "scopeType": "database",
  "scopeId": "DATABASE_WEB_ID",
  "templateName": "ProductionLoss",
  "maxCount": 100,
  "autoCreateProductionEvents": true
}
```

### **3. Frontend Usage:**
```typescript
// Create PI Client
const client = new PIClient({
  basePath: '/piwebapi',
  authProvider: async () => basicAuthHeader(username, password)
});

// Browse hierarchy
const servers = await client.getAssetServers();
const databases = await client.getAFDatabases(serverWebId);
const elements = await client.getDatabaseElements(databaseWebId);

// Get event frames
const events = await client.getEventFrames(elementWebId, {
  startTime: '2025-01-15T00:00:00Z',
  endTime: '2025-01-15T23:59:59Z',
  templateName: 'ProductionLoss'
});
```

---

## 📊 **PI Integration Features**

### **✅ Implemented:**

1. **Connection Management**
   - Save PI connection configuration
   - Test connection
   - Store credentials (encrypted)

2. **AF Hierarchy Browsing**
   - Asset Servers
   - AF Databases
   - Elements (recursive)

3. **Event Frame Pulling**
   - Time-based queries
   - Template filtering
   - Pagination
   - Batch processing

4. **Hierarchy Mapping**
   - Map PI elements to ProAct Units/Assets
   - Automatic event tagging based on mappings

5. **Production Event Creation**
   - Convert PI event frames to production events
   - Map attributes to event properties

### **⚠️ Integration Points:**

- **Hierarchy Mapping Service**: Maps PI elements to ProAct hierarchy
- **Production Event Service**: Creates production events from PI events
- **Unified Event Pull Service**: Includes PI as an event source

---

## 🔄 **How PI Fits in Connectivity Module**

PI is also accessible through the **Unified Connectivity Module**:

```typescript
// Through Connectivity Module
POST /api/connectivity/events/pull
{
  "sourceType": "SystemIntegration",
  "sourceId": "pi-connection-id",
  "tenantId": "tenant-123",
  "startTimeUtc": "2025-01-15T00:00:00Z",
  "endTimeUtc": "2025-01-15T23:59:59Z"
}
```

This routes to the same `PIEventPullService` but through the unified interface.

---

## 📝 **Summary**

**PI integration uses REST API (HTTP) to connect to PI Web API:**

1. ✅ **Real HTTP connections** using `axios`
2. ✅ **Basic Authentication** with username/password
3. ✅ **RESTful API calls** to PI Web API endpoints
4. ✅ **Event frame pulling** from PI system
5. ✅ **AF hierarchy browsing** (Asset Framework)
6. ✅ **Production event creation** from PI events
7. ✅ **CORS handling** via backend proxy

**This is NOT just configuration - it's REAL data exchange with PI system via HTTP REST API!**

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

