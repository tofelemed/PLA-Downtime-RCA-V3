# ProAct Backend API Reference

## Overview
This document describes the RESTful API endpoints, authentication, and real-time features for the ProAct backend (NestJS, SQL Server, JWT Auth, Socket.IO). Use this as a guide for frontend-backend integration.

---
working folder for backend: /server/pro-act-backend
## Authentication
- **POST /auth/login** — Login with email and password, returns JWT
- **POST /auth/register** — Register a new user (if enabled)
- **GET /auth/profile** — Get current user profile (JWT required)
- **(SSO endpoints will be added in the future)**

**All protected endpoints require the `Authorization: Bearer <token>` header.**

---

## Entities & CRUD Endpoints
For each entity, the following endpoints are available:

| Method | Endpoint                | Description           |
|--------|------------------------|-----------------------|
| GET    | /entity                | List/query all        |
| GET    | /entity/:id            | Get by ID             |
| POST   | /entity                | Create new            |
| PUT    | /entity/:id            | Update by ID          |
| DELETE | /entity/:id            | Delete by ID          |

### Example Entities (replace `entity` with actual name):
- /users
- /organizations
- /tenants
- /units
- /assets
- /audit-logs
- /impact-codes
- /oee-codes
- /rca-cause-codes
- /verification-status-codes
- /products
- /production-plans
- /production-plan-templates
- /production-events
- /rcas
- /rca-recommendations
- /rca-evidence
- /logic-tree-nodes
- /app-settings
- /rca-templates
- /evidence-categories
- /evidence-locations
- /production-losses
- /oee-summaries
- /reconcile-forms
- /loss-categories
- /unmapped-events
- /reason-codes
- /dashboard-configurations

---

## User Endpoints
- **GET /users** — List all users
- **GET /users/:id** — Get user by ID
- **POST /users** — Create user
- **PUT /users/:id** — Update user
- **DELETE /users/:id** — Delete user

### User Fields
| Field           | Type      | Nullable | Notes                       |
|-----------------|-----------|----------|-----------------------------|
| id              | uuid      | NO       | Primary Key                 |
| name            | string    | NO       |                             |
| email           | string    | NO       | Unique                      |
| passwordHash    | string    | NO       |                             |
| role            | string    | NO       | Enum: SuperAdmin, OrgAdmin, TenantAdmin, Analyst, Engineer, Operator |
| isActive        | boolean   | NO       |                             |
| tenantId        | uuid      | YES      | FK to Tenant                |
| organizationId  | uuid      | YES      | FK to Organization          |
| createdAt       | datetime  | NO       |                             |
| updatedAt       | datetime  | NO       |                             |

---

## Organization Endpoints
- **GET /organizations** — List all organizations
- **GET /organizations/:id** — Get organization by ID
- **POST /organizations** — Create organization
- **PUT /organizations/:id** — Update organization
- **DELETE /organizations/:id** — Delete organization

### Organization Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| code          | string    | NO       | Unique          |
| description   | string    | YES      |                 |
| isActive      | boolean   | NO       |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |
| tenantId      | uuid      | YES      |                 |

---

## Tenant Endpoints
- **GET /tenants** — List all tenants
- **GET /tenants/:id** — Get tenant by ID
- **POST /tenants** — Create tenant
- **PUT /tenants/:id** — Update tenant
- **DELETE /tenants/:id** — Delete tenant

### Tenant Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| code          | string    | NO       | Unique          |
| description   | string    | YES      |                 |
| organizationId| uuid      | NO       | FK to Organization |
| isActive      | boolean   | NO       |                 |
| address       | string    | YES      |                 |
| contactPerson | string    | YES      |                 |
| contactEmail  | string    | YES      |                 |
| contactPhone  | string    | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Unit Endpoints
- **GET /units** — List all units
- **GET /units/:id** — Get unit by ID
- **POST /units** — Create unit
- **PUT /units/:id** — Update unit
- **DELETE /units/:id** — Delete unit

### Unit Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| code          | string    | NO       | Unique          |
| description   | string    | YES      |                 |
| capacity      | int       | NO       |                 |
| unitOfMeasure | string    | NO       |                 |
| idealCycleTime| float     | YES      |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Asset Endpoints
- **GET /assets** — List all assets
- **GET /assets/:id** — Get asset by ID
- **POST /assets** — Create asset
- **PUT /assets/:id** — Update asset
- **DELETE /assets/:id** — Delete asset

### Asset Fields
| Field               | Type      | Nullable | Notes           |
|---------------------|-----------|----------|-----------------|
| id                  | uuid      | NO       | Primary Key     |
| name                | string    | NO       |                 |
| code                | string    | NO       | Unique          |
| unitId              | uuid      | NO       | FK to Unit      |
| description         | string    | YES      |                 |
| assetType           | string    | NO       | Enum            |
| criticality         | string    | NO       | Enum            |
| manufacturer        | string    | YES      |                 |
| model               | string    | YES      |                 |
| serialNumber        | string    | YES      |                 |
| installationDate    | datetime  | YES      |                 |
| lastMaintenanceDate | datetime  | YES      |                 |
| nextMaintenanceDate | datetime  | YES      |                 |
| status              | string    | NO       | Enum            |
| tenantId            | uuid      | NO       | FK to Tenant    |
| createdAt           | datetime  | NO       |                 |
| updatedAt           | datetime  | NO       |                 |

---

## Audit Log Endpoints
- **GET /audit-logs** — List all audit logs
- **GET /audit-logs/:id** — Get audit log by ID
- **POST /audit-logs** — Create audit log
- **PUT /audit-logs/:id** — Update audit log
- **DELETE /audit-logs/:id** — Delete audit log

### Audit Log Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| userId        | uuid      | NO       | FK to User      |
| userName      | string    | NO       |                 |
| action        | string    | NO       |                 |
| entityType    | string    | NO       |                 |
| entityId      | uuid      | NO       |                 |
| details       | string    | NO       |                 |
| organizationId| uuid      | NO       | FK to Organization |
| tenantId      | uuid      | NO       | FK to Tenant    |
| ipAddress     | string    | YES      |                 |
| userAgent     | string    | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |
| timestamp     | datetime  | YES      |                 |

---

<!-- The following sections are to be expanded for all other entities as per the extracted interfaces, following the same format. -->

## Impact Code Endpoints
- **GET /impact-codes** — List all impact codes
- **GET /impact-codes/:id** — Get impact code by ID
- **POST /impact-codes** — Create impact code
- **PUT /impact-codes/:id** — Update impact code
- **DELETE /impact-codes/:id** — Delete impact code

### Impact Code Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| code          | string    | NO       | Unique          |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| category      | string    | NO       | Enum: Quality, Availability, Performance |
| costPerUnit   | float     | YES      |                 |
| costPerHour   | float     | YES      |                 |
| costBasis     | string    | YES      | Enum: perUnit, perHour |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## OEE Code Endpoints
- **GET /oee-codes** — List all OEE codes
- **GET /oee-codes/:id** — Get OEE code by ID
- **POST /oee-codes** — Create OEE code
- **PUT /oee-codes/:id** — Update OEE code
- **DELETE /oee-codes/:id** — Delete OEE code

### OEE Code Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| code          | string    | NO       | Unique          |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| category      | string    | NO       | Enum: Planned, Unplanned |
| impactType    | string    | NO       | Enum: Availability, Performance, Quality |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## RCA Cause Code Endpoints
- **GET /rca-cause-codes** — List all RCA cause codes
- **GET /rca-cause-codes/:id** — Get RCA cause code by ID
- **POST /rca-cause-codes** — Create RCA cause code
- **PUT /rca-cause-codes/:id** — Update RCA cause code
- **DELETE /rca-cause-codes/:id** — Delete RCA cause code

### RCA Cause Code Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| code          | string    | NO       | Unique          |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| category      | string    | NO       | Enum: Equipment, Process, Material, Personnel, Environment, Method |
| parentId      | uuid      | YES      | Self FK         |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Verification Status Code Endpoints
- **GET /verification-status-codes** — List all verification status codes
- **GET /verification-status-codes/:id** — Get verification status code by ID
- **POST /verification-status-codes** — Create verification status code
- **PUT /verification-status-codes/:id** — Update verification status code
- **DELETE /verification-status-codes/:id** — Delete verification status code

### Verification Status Code Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| code          | string    | NO       | Unique          |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| color         | string    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| items         | string[]  | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Product Endpoints
- **GET /products** — List all products
- **GET /products/:id** — Get product by ID
- **POST /products** — Create product
- **PUT /products/:id** — Update product
- **DELETE /products/:id** — Delete product

### Product Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| code          | string    | NO       | Unique          |
| unitOfMeasure | string    | NO       |                 |
| description   | string    | YES      |                 |
| standardCost  | float     | NO       |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Production Plan Endpoints
- **GET /production-plans** — List all production plans
- **GET /production-plans/:id** — Get production plan by ID
- **POST /production-plans** — Create production plan
- **PUT /production-plans/:id** — Update production plan
- **DELETE /production-plans/:id** — Delete production plan

### Production Plan Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| unitId        | uuid      | NO       | FK to Unit      |
| productId     | uuid      | NO       | FK to Product   |
| plannedQuantity| float    | NO       |                 |
| toleranceLimit| float     | NO       |                 |
| startDate     | datetime  | NO       |                 |
| endDate       | datetime  | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| planBasis     | string    | YES      |                 |
| usefulProductionTime| object| YES    |                 |
| recurrence    | string    | YES      |                 |
| dataEntryFrequency| string| YES      |                 |
| status        | string    | NO       | Enum: Planned, Active, Completed, Cancelled |
| actualQuantity| float     | YES      |                 |
| shift         | string    | YES      |                 |
| crew          | string    | YES      |                 |
| plannerNotes  | string    | YES      |                 |
| comments      | object[]  | YES      |                 |
| approvalStatus| string    | NO       | Enum: Draft, Pending Review, Pending Approval, Approved, Rejected |
| submittedBy   | string    | YES      |                 |
| submittedAt   | datetime  | YES      |                 |
| reviewedBy    | string    | YES      |                 |
| reviewedAt    | datetime  | YES      |                 |
| approvedBy    | string    | YES      |                 |
| approvedAt    | datetime  | YES      |                 |
| rejectionReason| string   | YES      |                 |
| customAttributes| object  | YES      |                 |
| auditTrail    | object[]  | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Production Plan Template Endpoints
- **GET /production-plan-templates** — List all production plan templates
- **GET /production-plan-templates/:id** — Get production plan template by ID
- **POST /production-plan-templates** — Create production plan template
- **PUT /production-plan-templates/:id** — Update production plan template
- **DELETE /production-plan-templates/:id** — Delete production plan template

### Production Plan Template Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| unitId        | uuid      | NO       | FK to Unit      |
| productIds    | uuid[]    | NO       |                 |
| planBasis     | string    | NO       |                 |
| startDate     | datetime  | NO       |                 |
| endDate       | datetime  | NO       |                 |
| recurrence    | string    | YES      |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| orgId         | uuid      | YES      | FK to Organization |
| version       | int       | YES      |                 |
| usefulProductionTime| object| YES    |                 |
| dataEntryFrequency| string| YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Production Event Endpoints
- **GET /production-events** — List all production events
- **GET /production-events/:id** — Get production event by ID
- **POST /production-events** — Create production event
- **PUT /production-events/:id** — Update production event
- **DELETE /production-events/:id** — Delete production event

### Production Event Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| eventId       | string    | NO       |                 |
| planId        | uuid      | YES      | FK to ProductionPlan |
| unitId        | uuid      | NO       | FK to Unit      |
| assetId       | uuid      | YES      | FK to Asset     |
| impactCodeId  | uuid      | YES      | FK to ImpactCode|
| oeeCodeId     | uuid      | YES      | FK to OEECode   |
| description   | string    | NO       |                 |
| startTime     | datetime  | NO       |                 |
| endTime       | datetime  | YES      |                 |
| source        | string    | NO       | Enum: Manual, Simulated PI, CMMS |
| quantity      | float     | YES      |                 |
| cost          | float     | YES      |                 |
| status        | string    | NO       | Enum: Open, Coded, RCA Required, Closed, Investigating, In Progress, Completed, Cancelled |
| rcaId         | uuid      | YES      | FK to RCA       |
| eventType     | string    | NO       | Enum: ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput |
| parameter     | string    | YES      |                 |
| value         | float     | YES      |                 |
| limit         | float     | YES      |                 |
| limitType     | string    | YES      | Enum: High, Low |
| breachDuration| float     | YES      |                 |
| solType       | string    | YES      | Enum: Safety, Operational |
| apmType       | string    | YES      |                 |
| severity      | string    | YES      | Enum: Low, Medium, High, Critical |
| recommendedAction| string | YES      |                 |
| workOrderId   | string    | YES      |                 |
| failureMode   | string    | YES      |                 |
| defectiveQuantity| float  | YES      |                 |
| shift         | string    | YES      |                 |
| crew          | string    | YES      |                 |
| auditTrail    | object[]  | YES      |                 |
| lossCategory  | string    | YES      |                 |
| operatorName  | string    | YES      |                 |
| reasonCodeId  | uuid      | YES      | FK to ReasonCode|
| duration      | float     | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## RCA Endpoints
- **GET /rcas** — List all RCAs
- **GET /rcas/:id** — Get RCA by ID
- **POST /rcas** — Create RCA
- **PUT /rcas/:id** — Update RCA
- **DELETE /rcas/:id** — Delete RCA

### RCA Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| eventId       | uuid      | NO       | FK to ProductionEvent |
| title         | string    | NO       |                 |
| description   | string    | NO       |                 |
| status        | string    | NO       | Enum: Draft, In Progress, Analysis, Published, Closed |
| teamLeadId    | uuid      | NO       | FK to User      |
| teamMemberIds | uuid[]    | NO       |                 |
| priority      | string    | NO       | Enum: Low, Medium, High, Critical |
| targetCloseDate| datetime | YES      |                 |
| actualCloseDate| datetime | YES      |                 |
| rootCause     | string    | YES      |                 |
| recommendations| object[] | NO       |                 |
| logicTree     | object[]  | YES      |                 |
| evidence      | object[]  | NO       |                 |
| templateId    | uuid      | YES      | FK to RCATemplate |
| teamCharter   | string    | YES      |                 |
| eventDiagram  | object    | YES      |                 |
| preFailureRate| float     | YES      |                 |
| postFailureRate| float    | YES      |                 |
| failureCostPerIncident| float| YES  |                 |
| implementationCost| float | YES      |                 |
| timeToResolution| float   | YES      |                 |
| timeToImplementation| float| YES    |                 |
| effectivenessScore| float | YES      |                 |
| lastUpdated   | datetime  | YES      |                 |
| trackingNotes | string    | YES      |                 |
| phaseTimeline | object    | YES      |                 |
| calculatedROI | float     | YES      |                 |
| costSavings   | float     | YES      |                 |
| downtimeReduction| float  | YES      |                 |
| productivityImprovement| float| YES |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## RCA Recommendation Endpoints
- **GET /rca-recommendations** — List all RCA recommendations
- **GET /rca-recommendations/:id** — Get RCA recommendation by ID
- **POST /rca-recommendations** — Create RCA recommendation
- **PUT /rca-recommendations/:id** — Update RCA recommendation
- **DELETE /rca-recommendations/:id** — Delete RCA recommendation

### RCA Recommendation Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| rcaId         | uuid      | NO       | FK to RCA       |
| title         | string    | NO       |                 |
| description   | string    | NO       |                 |
| priority      | string    | NO       | Enum: Low, Medium, High |
| assigneeId    | uuid      | NO       | FK to User      |
| dueDate       | datetime  | YES      |                 |
| status        | string    | NO       | Enum: Open, In Progress, Completed, Cancelled |
| cmmsWorkOrderId| string   | YES      |                 |
| estimatedCost | float     | YES      |                 |
| actualCost    | float     | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## RCA Evidence Endpoints
- **GET /rca-evidence** — List all RCA evidence
- **GET /rca-evidence/:id** — Get RCA evidence by ID
- **POST /rca-evidence** — Create RCA evidence
- **PUT /rca-evidence/:id** — Update RCA evidence
- **DELETE /rca-evidence/:id** — Delete RCA evidence

### RCA Evidence Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| rcaId         | uuid      | NO       | FK to RCA       |
| title         | string    | NO       |                 |
| description   | string    | NO       |                 |
| type          | string    | NO       | Enum: Photo, Document, Time Series, Note, Video |
| fileName      | string    | YES      |                 |
| filePath      | string    | YES      |                 |
| collectedBy   | string    | NO       |                 |
| collectedAt   | datetime  | NO       |                 |
| nodeIds       | uuid[]    | YES      |                 |
| fileBlob      | blob      | YES      |                 |
| category      | string    | YES      |                 |
| location      | string    | YES      |                 |
| timestamp     | datetime  | YES      |                 |
| relatedAssetId| uuid      | YES      | FK to Asset     |
| severity      | string    | YES      | Enum: Low, Medium, High, Critical |
| tags          | string[]  | YES      |                 |
| verified      | boolean   | YES      |                 |
| fiveP         | string    | YES      | Enum: Parts, Paper, People, Place, Process |
| task          | string    | YES      |                 |
| dueDate       | datetime  | YES      |                 |
| status        | string    | YES      | Enum: pending, completed |
| attachments   | object[]  | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Logic Tree Node Endpoints
- **GET /logic-tree-nodes** — List all logic tree nodes
- **GET /logic-tree-nodes/:id** — Get logic tree node by ID
- **POST /logic-tree-nodes** — Create logic tree node
- **PUT /logic-tree-nodes/:id** — Update logic tree node
- **DELETE /logic-tree-nodes/:id** — Delete logic tree node

### Logic Tree Node Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| rcaId         | uuid      | NO       | FK to RCA       |
| parentId      | uuid      | YES      | Self FK         |
| question      | string    | NO       |                 |
| answer        | string    | YES      |                 |
| type          | string    | NO       | Enum: Root, Why, How, Cause |
| verified      | boolean   | NO       |                 |
| evidenceIds   | uuid[]    | NO       |                 |
| position      | object    | NO       |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Task Endpoints
- **GET /tasks** — List all tasks
- **GET /tasks/:id** — Get task by ID
- **POST /tasks** — Create task
- **PUT /tasks/:id** — Update task
- **DELETE /tasks/:id** — Delete task

### Task Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| title         | string    | NO       |                 |
| description   | string    | YES      |                 |
| assignedTo    | uuid      | NO       | FK to User      |
| assignedBy    | uuid      | NO       | FK to User      |
| priority      | string    | NO       | Enum: Low, Medium, High, Critical |
| status        | string    | NO       | Enum: Open, In Progress, Completed, Cancelled |
| dueDate       | datetime  | YES      |                 |
| completedDate | datetime  | YES      |                 |
| entityType    | string    | YES      |                 |
| entityId      | uuid      | YES      |                 |
| organizationId| uuid      | NO       | FK to Organization |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## RCA Template Endpoints
- **GET /rca-templates** — List all RCA templates
- **GET /rca-templates/:id** — Get RCA template by ID
- **POST /rca-templates** — Create RCA template
- **PUT /rca-templates/:id** — Update RCA template
- **DELETE /rca-templates/:id** — Delete RCA template

### RCA Template Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| category      | string    | NO       |                 |
| logicTreeStructure| object| NO       |                 |
| verificationChecklist| string[]| NO  |                 |
| organizationId| uuid      | NO       | FK to Organization |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Evidence Category Endpoints
- **GET /evidence-categories** — List all evidence categories
- **GET /evidence-categories/:id** — Get evidence category by ID
- **POST /evidence-categories** — Create evidence category
- **PUT /evidence-categories/:id** — Update evidence category
- **DELETE /evidence-categories/:id** — Delete evidence category

### Evidence Category Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |

---

## Evidence Location Endpoints
- **GET /evidence-locations** — List all evidence locations
- **GET /evidence-locations/:id** — Get evidence location by ID
- **POST /evidence-locations** — Create evidence location
- **PUT /evidence-locations/:id** — Update evidence location
- **DELETE /evidence-locations/:id** — Delete evidence location

### Evidence Location Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| name          | string    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |

---

## Production Loss Endpoints
- **GET /production-losses** — List all production losses
- **GET /production-losses/:id** — Get production loss by ID
- **POST /production-losses** — Create production loss
- **PUT /production-losses/:id** — Update production loss
- **DELETE /production-losses/:id** — Delete production loss

### Production Loss Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| planId        | uuid      | NO       | FK to ProductionPlan |
| period        | string    | NO       |                 |
| actual        | float     | NO       |                 |
| shortRangePlan| float     | NO       |                 |
| losses        | float     | NO       |                 |
| unaccountedLoss| float    | NO       |                 |
| action        | string    | NO       | Enum: Reconcile, RCA Required, Closed |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## OEE Summary Endpoints
- **GET /oee-summaries** — List all OEE summaries
- **GET /oee-summaries/:id** — Get OEE summary by ID
- **POST /oee-summaries** — Create OEE summary
- **PUT /oee-summaries/:id** — Update OEE summary
- **DELETE /oee-summaries/:id** — Delete OEE summary

### OEE Summary Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| planId        | uuid      | NO       | FK to ProductionPlan |
| availability  | float     | NO       |                 |
| performance   | float     | NO       |                 |
| quality       | float     | NO       |                 |
| overallOEE    | float     | NO       |                 |
| period        | string    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Loss Category Endpoints
- **GET /loss-categories** — List all loss categories
- **GET /loss-categories/:id** — Get loss category by ID
- **POST /loss-categories** — Create loss category
- **PUT /loss-categories/:id** — Update loss category
- **DELETE /loss-categories/:id** — Delete loss category

### Loss Category Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| reconcileFormId| uuid     | NO       | FK to ReconcileForm |
| categoryName  | string    | NO       |                 |
| lossAmount    | float     | NO       |                 |
| impactCodeId  | uuid      | NO       | FK to ImpactCode|
| oeeCodeId     | uuid      | NO       | FK to OEECode   |
| description   | string    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Reconcile Form Endpoints
- **GET /reconcile-forms** — List all reconcile forms
- **GET /reconcile-forms/:id** — Get reconcile form by ID
- **POST /reconcile-forms** — Create reconcile form
- **PUT /reconcile-forms/:id** — Update reconcile form
- **DELETE /reconcile-forms/:id** — Delete reconcile form

### Reconcile Form Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| lossId        | uuid      | NO       | FK to ProductionLoss |
| totalLossAmount| float    | NO       |                 |
| categorizedLossAmount| float| NO    |                 |
| unaccountedLossAmount| float| NO    |                 |
| productionEvent| string   | NO       |                 |
| comment       | string    | NO       |                 |
| status        | string    | NO       | Enum: Draft, Submitted, Approved, Rejected |
| categories    | object[]  | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Unmapped Event Endpoints
- **GET /unmapped-events** — List all unmapped events
- **GET /unmapped-events/:id** — Get unmapped event by ID
- **POST /unmapped-events** — Create unmapped event
- **PUT /unmapped-events/:id** — Update unmapped event
- **DELETE /unmapped-events/:id** — Delete unmapped event

### Unmapped Event Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| tenantId      | uuid      | NO       | FK to Tenant    |
| unitId        | uuid      | NO       | FK to Unit      |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Reason Code Endpoints
- **GET /reason-codes** — List all reason codes
- **GET /reason-codes/:id** — Get reason code by ID
- **POST /reason-codes** — Create reason code
- **PUT /reason-codes/:id** — Update reason code
- **DELETE /reason-codes/:id** — Delete reason code

### Reason Code Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| code          | string    | NO       | Unique          |
| name          | string    | NO       |                 |
| description   | string    | YES      |                 |
| parentId      | uuid      | YES      | Self FK         |
| tenantId      | uuid      | NO       | FK to Tenant    |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## Dashboard Configuration Endpoints
- **GET /dashboard-configurations** — List all dashboard configurations
- **GET /dashboard-configurations/:id** — Get dashboard configuration by ID
- **POST /dashboard-configurations** — Create dashboard configuration
- **PUT /dashboard-configurations/:id** — Update dashboard configuration
- **DELETE /dashboard-configurations/:id** — Delete dashboard configuration

### Dashboard Configuration Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| id            | uuid      | NO       | Primary Key     |
| oee           | object    | NO       |                 |
| losses        | object    | NO       |                 |
| costs         | object    | NO       |                 |
| bottleneckRisk| object    | NO       |                 |
| display       | object    | NO       |                 |
| performance   | object    | NO       |                 |
| quality       | object    | NO       |                 |
| availability  | object    | NO       |                 |
| tenantId      | uuid      | NO       | FK to Tenant    |
| isActive      | boolean   | NO       |                 |
| version       | int       | NO       |                 |
| lastModifiedBy| string    | YES      |                 |
| lastModifiedAt| datetime  | YES      |                 |
| createdAt     | datetime  | NO       |                 |
| updatedAt     | datetime  | NO       |                 |

---

## App Settings Endpoints
- **GET /app-settings** — List all app settings
- **GET /app-settings/:id** — Get app setting by key
- **POST /app-settings** — Create app setting
- **PUT /app-settings/:id** — Update app setting
- **DELETE /app-settings/:id** — Delete app setting

### App Settings Fields
| Field         | Type      | Nullable | Notes           |
|---------------|-----------|----------|-----------------|
| key           | string    | NO       | Primary Key     |
| value         | any       | NO       |                 |

---

## Real-Time (Socket.IO)
- Connect to `/socket.io` with JWT token.
- Listen for events: `entityCreated`, `entityUpdated`, `entityDeleted` (e.g., `userCreated`, `userUpdated`, ...)
- Payload: the full entity object

---

## Integration Notes
- All endpoints are RESTful and return JSON.
- Use JWT for authentication on all protected routes.
- Use Swagger docs at `/api` for live API reference and testing.
- All modules are designed to be microservice-friendly and reusable in other apps.
- SSO endpoints will be added in the future (OAuth2/SAML ready).

---

## Adding New Entities
- Follow the same CRUD pattern as above.
- Each entity has its own module, controller, service, and DTOs.

---

## Contact
For questions or issues, contact the backend team or check the Swagger docs at `/api` once the backend is running. 