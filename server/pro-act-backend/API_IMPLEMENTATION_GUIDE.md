# ProAct Backend API Implementation Guide

Complete reference for all API endpoints based on STORAGE_SERVICE_BACKEND_REFERENCE.md

## Base URL
```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

All endpoints (except `/auth/login` and `/auth/register`) require Bearer token authentication.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "Manager"
  }
}
```

### Using Bearer Token
```http
GET /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## API Endpoints Overview

### Core Entities (6 modules - 30 endpoints)
1. **Users** - `/api/users`
2. **Organizations** - `/api/organizations`
3. **Tenants** - `/api/tenants`
4. **Units** - `/api/units`
5. **Assets** - `/api/assets`
6. **Audit Logs** - `/api/audit-logs`

### Master Data (5 modules - 25 endpoints)
7. **Impact Codes** - `/api/impact-codes`
8. **OEE Codes** - `/api/oee-codes`
9. **RCA Cause Codes** - `/api/rca-cause-codes`
10. **Verification Status Codes** - `/api/verification-status-codes`
11. **Reason Codes** - `/api/reason-codes`

### Production (9 modules - 45 endpoints)
12. **Products** - `/api/products`
13. **Production Plans** - `/api/production-plans`
14. **Production Plan Templates** - `/api/production-plan-templates`
15. **Production Events** - `/api/production-events`
16. **Production Losses** - `/api/production-losses`
17. **OEE Summaries** - `/api/oee-summaries`
18. **Reconcile Forms** - `/api/reconcile-forms`
19. **Loss Categories** - `/api/loss-categories`
20. **Unmapped Events** - `/api/unmapped-events`

### RCA (10 modules - 50 endpoints)
21. **RCAs** - `/api/rcas`
22. **RCA Recommendations** - `/api/rca-recommendations`
23. **RCA Evidence** - `/api/rca-evidence`
24. **Logic Tree Nodes** - `/api/logic-tree-nodes`
25. **RCA Trigger Configs** - `/api/rca-trigger-configs`
26. **RCA Knowledge Base** - `/api/rca-knowledge-base`
27. **RCA Analysis Configs** - `/api/rca-analysis-configs`
28. **RCA Templates** - `/api/rca-templates`
29. **Evidence Categories** - `/api/evidence-categories`
30. **Evidence Locations** - `/api/evidence-locations`

### Analysis Tools (6 modules - 30 endpoints)
31. **Five Why Analyses** - `/api/five-why-analyses`
32. **Fishbone Diagrams** - `/api/fishbone-diagrams`
33. **FMEA Analyses** - `/api/fmea-analyses`
34. **Fault Tree Analyses** - `/api/fault-tree-analyses`
35. **Barrier Analyses** - `/api/barrier-analyses`
36. **Change Analyses** - `/api/change-analyses`

### PI Integration (8 modules - 40 endpoints)
37. **PI Connections** - `/api/pi-connections`
38. **PI AF Elements** - `/api/pi-af-elements`
39. **AF Bindings** - `/api/af-bindings`
40. **PI Events** - `/api/pi-events`
41. **PI Mappings** - `/api/pi-mappings`
42. **PI Sync Watermarks** - `/api/pi-sync-watermarks`
43. **PI Sync Jobs** - `/api/pi-sync-jobs`
44. **Historian Tags** - `/api/historian-tags`

### Integration (1 module - 5 endpoints)
45. **Data Sources** - `/api/data-sources`

### Custom Attributes (2 modules - 10 endpoints)
46. **Custom Attribute Definitions** - `/api/custom-attribute-definitions`
47. **Custom Attribute Values** - `/api/custom-attribute-values`

### Dashboard & Settings (2 modules - 13 endpoints)
48. **Dashboard Configurations** - `/api/dashboard-configurations`
49. **App Settings** - `/api/settings`

### Historian History (1 module - 8 endpoints)
50. **Historian History** - `/api/historian/history`

---

## Standard CRUD Patterns

All entities follow this standard REST pattern:

### Create
```http
POST /api/{resource}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Example",
  "tenantId": "tenant-uuid",
  // ... other fields
}

Response: 201 Created
{
  "id": "new-uuid",
  "name": "Example",
  "tenantId": "tenant-uuid",
  "createdAt": "2025-10-18T12:00:00.000Z",
  "updatedAt": "2025-10-18T12:00:00.000Z",
  // ... other fields
}
```

### Get All (with filters)
```http
GET /api/{resource}?tenantId={id}&organizationId={id}
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": "uuid-1",
    "name": "Item 1",
    // ...
  },
  {
    "id": "uuid-2",
    "name": "Item 2",
    // ...
  }
]
```

### Get One
```http
GET /api/{resource}/{id}
Authorization: Bearer {token}

Response: 200 OK
{
  "id": "uuid",
  "name": "Item",
  // ...
}

Response: 404 Not Found
{
  "statusCode": 404,
  "message": "Resource with ID {id} not found"
}
```

### Update
```http
PATCH /api/{resource}/{id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Name",
  // ... fields to update
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Updated Name",
  "updatedAt": "2025-10-18T13:00:00.000Z",
  // ... all fields
}
```

### Delete
```http
DELETE /api/{resource}/{id}
Authorization: Bearer {token}

Response: 204 No Content
```

---

## Entity-Specific Examples

### 1. Users API

#### Create User
```http
POST /api/users
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "Manager",
  "tenantId": "tenant-123",
  "organizationId": "org-456"
}
```

#### Query Filters
```http
GET /api/users?tenantId=tenant-123&organizationId=org-456
```

---

### 2. Production Events API

#### Create Production Event
```http
POST /api/production-events
{
  "tenantId": "tenant-123",
  "unitId": "unit-456",
  "eventType": "Downtime",
  "eventName": "Equipment Failure",
  "startTime": "2025-10-18T08:00:00Z",
  "endTime": "2025-10-18T10:00:00Z",
  "duration": 120,
  "status": "Closed",
  "severity": "High",
  "impactCodeId": "impact-789",
  "description": "Motor bearing failure"
}
```

#### Query Filters
```http
GET /api/production-events?unitId=unit-456&status=Open&tenantId=tenant-123
```

**Specific Indexes**: unitId, status

---

### 3. RCAs API

#### Create RCA
```http
POST /api/rcas
{
  "tenantId": "tenant-123",
  "eventId": "event-456",
  "rcaNumber": "RCA-2025-001",
  "title": "Motor Bearing Failure Analysis",
  "description": "Root cause analysis of bearing failure",
  "status": "In Progress",
  "priority": "High",
  "assignedTo": "user-789",
  "teamMembers": ["user-789", "user-012"],
  "startDate": "2025-10-18T00:00:00Z",
  "targetCompletionDate": "2025-10-25T00:00:00Z"
}
```

#### Query Filters
```http
GET /api/rcas?eventId=event-456&status=InProgress&tenantId=tenant-123
```

**Specific Indexes**: eventId, status

---

### 4. Five Why Analysis API

#### Create Analysis
```http
POST /api/five-why-analyses
{
  "tenantId": "tenant-123",
  "rcaId": "rca-456",
  "problemStatement": "Motor bearing failed",
  "whyLevels": [
    {"level": 1, "why": "Why did motor fail?", "answer": "Bearing seized"},
    {"level": 2, "why": "Why did bearing seize?", "answer": "Lack of lubrication"},
    {"level": 3, "why": "Why no lubrication?", "answer": "Maintenance missed"},
    {"level": 4, "why": "Why was maintenance missed?", "answer": "No reminder system"},
    {"level": 5, "why": "Why no reminder?", "answer": "CMMS not configured"}
  ],
  "rootCause": "CMMS system not properly configured for this equipment"
}
```

#### Query Filters
```http
GET /api/five-why-analyses?rcaId=rca-456&tenantId=tenant-123
```

---

### 5. PI Connections API

#### Create PI Connection
```http
POST /api/pi-connections
{
  "tenantId": "tenant-123",
  "connectionName": "Plant A PI Server",
  "piWebApiUrl": "https://pi-server.company.com/piwebapi",
  "username": "piwebapi_user",
  "passwordEncrypted": "encrypted_password_here",
  "afDatabasePath": "\\\\AF-SERVER\\PlantA",
  "isActive": true
}
```

---

### 6. Custom Attribute Definitions API

#### Create Custom Attribute
```http
POST /api/custom-attribute-definitions
{
  "tenantId": "tenant-123",
  "entityType": "ProductionEvent",
  "attributeName": "equipment_temperature",
  "displayName": "Equipment Temperature",
  "description": "Temperature at time of event",
  "dataType": "number",
  "isRequired": false,
  "defaultValue": "0",
  "validationRules": {
    "min": 0,
    "max": 500
  },
  "displayOrder": 1,
  "isActive": true
}
```

#### Query Filters
```http
GET /api/custom-attribute-definitions?entityType=ProductionEvent&tenantId=tenant-123
```

---

### 7. Historian History API

Special endpoints for query history management:

#### Save History
```http
PUT /api/historian/history/tenant-123
[
  {
    "id": "history-1",
    "timestamp": "2025-10-18T12:00:00Z",
    "attributes": [...],
    "queryParams": {...},
    "resultCount": 150
  }
]
```

#### Load History
```http
GET /api/historian/history/tenant-123

Response:
[
  {
    "id": "history-1",
    "timestamp": "2025-10-18T12:00:00Z",
    "attributes": [...],
    "queryParams": {...},
    "resultCount": 150,
    "tenantId": "tenant-123"
  }
]
```

#### Add Single Entry
```http
POST /api/historian/history/tenant-123
{
  "timestamp": "2025-10-18T13:00:00Z",
  "attributes": [...],
  "queryParams": {...},
  "resultCount": 200
}
```

#### Remove Entry
```http
DELETE /api/historian/history/entry/history-1
```

#### Clear All History
```http
DELETE /api/historian/history/tenant-123
```

#### Export History
```http
GET /api/historian/history/tenant-123/export

Response:
[
  {
    "timestamp": "2025-10-18T12:00:00Z",
    "attributes": 5,
    "mode": "interpolated",
    "startTime": "2025-10-17T00:00:00Z",
    "endTime": "2025-10-18T00:00:00Z",
    "resultCount": 150,
    "attributeNames": "Tag1, Tag2, Tag3, Tag4, Tag5"
  }
]
```

#### Import History
```http
POST /api/historian/history/tenant-123/import
[
  {
    "id": "history-2",
    "timestamp": "2025-10-17T12:00:00Z",
    "attributes": [...],
    "queryParams": {...},
    "resultCount": 100
  }
]
```

---

## Query Parameters

### Common Query Parameters
- `tenantId` - Filter by tenant
- `organizationId` - Filter by organization
- `page` - Page number (pagination)
- `limit` - Items per page (default: 50, max: 1000)
- `sortBy` - Field to sort by
- `sortOrder` - `asc` or `desc`

### Entity-Specific Filters

**Production Events**
- `unitId` - Filter by unit
- `status` - Filter by status

**RCAs**
- `eventId` - Filter by event
- `status` - Filter by status

**Production Losses**
- `planId` - Filter by production plan
- `period` - Filter by period

**OEE Summaries**
- `planId` - Filter by production plan
- `period` - Filter by period

**Reconcile Forms**
- `lossId` - Filter by loss
- `status` - Filter by status

**Loss Categories**
- `reconcileFormId` - Filter by reconcile form

**PI AF Elements**
- `parentId` - Filter by parent element
- `template` - Filter by template

**PI Events**
- `template` - Filter by template
- `primaryAfId` - Filter by primary AF ID
- `startUtc` - Filter by start time

**Historian Tags**
- `category` - Filter by category
- `enabled` - Filter by enabled status

**Data Sources**
- `type` - Filter by source type
- `status` - Filter by status
- `enabled` - Filter by enabled status

**Custom Attribute Definitions**
- `entityType` - Filter by entity type

**Custom Attribute Values**
- `entityId` - Filter by entity ID
- `entityType` - Filter by entity type
- `attributeDefinitionId` - Filter by attribute definition

---

## Pagination Example

```http
GET /api/production-events?page=1&limit=50&sortBy=created At&sortOrder=desc&tenantId=tenant-123

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["name should not be empty", "email must be an email"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource with ID {id} not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Bulk Operations

### Bulk Create
```http
POST /api/{resource}/bulk
[
  { "name": "Item 1", ... },
  { "name": "Item 2", ... }
]

Response: 201 Created
[
  { "id": "uuid-1", "name": "Item 1", ... },
  { "id": "uuid-2", "name": "Item 2", ... }
]
```

### Bulk Delete
```http
DELETE /api/{resource}/bulk
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}

Response: 204 No Content
```

---

## Real-Time Events (WebSocket)

### Connect to WebSocket
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to tenant updates
socket.emit('subscribe', { tenantId: 'tenant-123' });

// Listen for updates
socket.on('dataUpdate', (event) => {
  console.log(event);
  // {
  //   storeName: 'productionEvents',
  //   action: 'create',
  //   data: {...},
  //   timestamp: '2025-10-18T12:00:00.000Z',
  //   tenantId: 'tenant-123'
  // }
});
```

### Event Types
- `create` - New entity created
- `update` - Entity updated
- `delete` - Entity deleted

---

## Swagger Documentation

Access interactive API documentation:

```
http://localhost:3000/api
```

Features:
- Try out endpoints
- View request/response schemas
- Download OpenAPI spec
- Test authentication

---

## Rate Limiting

Default limits:
- 100 requests per minute per IP
- Configurable via environment variables

Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697634000
```

---

## Versioning

API version is included in all responses:

```
X-API-Version: 1.0
```

---

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Get Resources
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Resource
```bash
curl -X POST http://localhost:3000/api/production-events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unitId":"unit-123","eventName":"Test Event",...}'
```

---

## Postman Collection

Import the Postman collection for easy testing:

1. File → Import
2. Select `ProAct_API.postman_collection.json`
3. Set environment variables:
   - `baseUrl`: http://localhost:3000/api
   - `token`: Your JWT token

---

## Summary

- **Total Endpoints**: 250+ across 50 modules
- **Authentication**: JWT Bearer tokens
- **Multi-Tenancy**: All queries filtered by tenantId
- **Real-Time**: WebSocket support for live updates
- **Documentation**: Swagger UI at `/api`
- **Error Handling**: Standard HTTP status codes
- **Pagination**: Supported on all list endpoints
- **Filtering**: Tenant, organization, and entity-specific filters
- **Validation**: Automatic validation using class-validator
- **Rate Limiting**: 100 requests/minute default

---

## Next Steps

1. Review Swagger documentation at `http://localhost:3000/api`
2. Test authentication flow
3. Test entity CRUD operations
4. Implement frontend API client
5. Set up WebSocket connection for real-time updates
6. Configure rate limiting and security headers
7. Set up monitoring and logging
8. Deploy to production environment

