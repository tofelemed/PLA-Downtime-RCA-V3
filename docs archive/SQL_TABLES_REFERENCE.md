# SQL Tables Reference for ProAct Entities

This document lists all entities (tables) and their fields as inferred from the frontend codebase. Use this as a reference for SQL Server schema design. Types are based on TypeScript and should be mapped to appropriate SQL Server types.

---

## User
| Column           | Type      | Nullable | Notes                       |
|------------------|-----------|----------|-----------------------------|
| id               | uuid      | NO       | Primary Key                 |
| name             | string    | NO       |                             |
| email            | string    | NO       | Unique                      |
| passwordHash     | string    | NO       |                             |
| role             | string    | NO       | Enum: SuperAdmin, OrgAdmin, TenantAdmin, Analyst, Engineer, Operator |
| isActive         | boolean   | NO       |                             |
| tenantId         | uuid      | YES      | FK to Tenant                |
| organizationId   | uuid      | YES      | FK to Organization          |
| createdAt        | datetime  | NO       |                             |
| updatedAt        | datetime  | NO       |                             |

---

## Organization
| Column         | Type      | Nullable | Notes           |
|----------------|-----------|----------|-----------------|
| id             | uuid      | NO       | Primary Key     |
| name           | string    | NO       |                 |
| code           | string    | NO       | Unique          |
| description    | string    | YES      |                 |
| isActive       | boolean   | NO       |                 |
| createdAt      | datetime  | NO       |                 |
| updatedAt      | datetime  | NO       |                 |
| tenantId       | uuid      | YES      |                 |

---

## Tenant
| Column         | Type      | Nullable | Notes           |
|----------------|-----------|----------|-----------------|
| id             | uuid      | NO       | Primary Key     |
| name           | string    | NO       |                 |
| code           | string    | NO       | Unique          |
| description    | string    | YES      |                 |
| organizationId | uuid      | NO       | FK to Organization |
| isActive       | boolean   | NO       |                 |
| address        | string    | YES      |                 |
| contactPerson  | string    | YES      |                 |
| contactEmail   | string    | YES      |                 |
| contactPhone   | string    | YES      |                 |
| createdAt      | datetime  | NO       |                 |
| updatedAt      | datetime  | NO       |                 |

---

## Unit
| Column         | Type      | Nullable | Notes           |
|----------------|-----------|----------|-----------------|
| id             | uuid      | NO       | Primary Key     |
| name           | string    | NO       |                 |
| code           | string    | NO       | Unique          |
| description    | string    | YES      |                 |
| capacity       | int       | NO       |                 |
| unitOfMeasure  | string    | NO       |                 |
| idealCycleTime | float     | YES      |                 |
| tenantId       | uuid      | NO       | FK to Tenant    |
| createdAt      | datetime  | NO       |                 |
| updatedAt      | datetime  | NO       |                 |

---

## Asset
| Column             | Type      | Nullable | Notes           |
|--------------------|-----------|----------|-----------------|
| id                 | uuid      | NO       | Primary Key     |
| name               | string    | NO       |                 |
| code               | string    | NO       | Unique          |
| unitId             | uuid      | NO       | FK to Unit      |
| description        | string    | YES      |                 |
| assetType          | string    | NO       | Enum            |
| criticality        | string    | NO       | Enum            |
| manufacturer       | string    | YES      |                 |
| model              | string    | YES      |                 |
| serialNumber       | string    | YES      |                 |
| installationDate   | datetime  | YES      |                 |
| lastMaintenanceDate| datetime  | YES      |                 |
| nextMaintenanceDate| datetime  | YES      |                 |
| status             | string    | NO       | Enum            |
| tenantId           | uuid      | NO       | FK to Tenant    |
| createdAt          | datetime  | NO       |                 |
| updatedAt          | datetime  | NO       |                 |

---

## AuditLog
| Column         | Type      | Nullable | Notes           |
|----------------|-----------|----------|-----------------|
| id             | uuid      | NO       | Primary Key     |
| userId         | uuid      | NO       | FK to User      |
| userName       | string    | NO       |                 |
| action         | string    | NO       |                 |
| entityType     | string    | NO       |                 |
| entityId       | uuid      | NO       |                 |
| details        | string    | NO       |                 |
| organizationId | uuid      | NO       | FK to Organization |
| tenantId       | uuid      | NO       | FK to Tenant    |
| ipAddress      | string    | YES      |                 |
| userAgent      | string    | YES      |                 |
| createdAt      | datetime  | NO       |                 |
| updatedAt      | datetime  | NO       |                 |
| timestamp      | datetime  | YES      |                 |

---

<!-- Continue for all other entities as per the extracted interfaces, following the same format. If you want the full list for all entities (ImpactCode, OEECode, RCACauseCode, VerificationStatusCode, Product, ProductionPlan, ProductionPlanTemplate, ProductionEvent, RCA, RCARecommendation, RCAEvidence, LogicTreeNode, Task, RCATemplate, EvidenceCategory, EvidenceLocation, ReasonCode, DashboardConfiguration, etc.), let me know and I will expand this file further. --> 