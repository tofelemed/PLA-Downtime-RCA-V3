# Storage Service Backend Reference Documentation

This document provides a complete reference for implementing a backend that matches the frontend StorageService architecture. Every entity, field, store, index, and method is documented for direct backend implementation.

---

## Table of Contents
1. [Database Configuration](#database-configuration)
2. [Base Entity Structure](#base-entity-structure)
3. [Core Entities](#core-entities)
4. [Master Data Entities](#master-data-entities)
5. [Production Entities](#production-entities)
6. [RCA Entities](#rca-entities)
7. [Analysis Tool Entities](#analysis-tool-entities)
8. [PI Integration Entities](#pi-integration-entities)
9. [Custom Attributes](#custom-attributes)
10. [All Object Stores](#all-object-stores)
11. [Indexes Reference](#indexes-reference)
12. [CRUD Operations](#crud-operations)
13. [Real-Time Event System](#real-time-event-system)
14. [Historian History Database](#historian-history-database)
15. [API Endpoints Mapping](#api-endpoints-mapping)

---

## Database Configuration

### IndexedDB Information
- **Database Name**: `ProActDB`
- **Current Version**: `19`
- **Latest Update Reason**: Added PI sync jobs store for automated event syncing

### Settings Store
- **Store Name**: `appSettings`
- **Key Path**: `key`
- **Purpose**: Key-value store for application settings
- **Schema**:
  ```typescript
  {
    key: string;    // Primary key
    value: any;     // JSON value
  }
  ```

---

## Base Entity Structure

All entities extend this base structure:

```typescript
interface BaseEntity {
  id: string;                    // UUID generated using crypto.randomUUID()
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
  tenantId?: string;            // Optional tenant scope
  organizationId?: string;      // Optional organization scope
}
```

### Field Details
| Field | Type | Required | Auto-Generated | Description |
|-------|------|----------|----------------|-------------|
| `id` | string | Yes | Yes | UUID primary key |
| `createdAt` | string | Yes | Yes | Creation timestamp (ISO 8601) |
| `updatedAt` | string | Yes | Yes | Last update timestamp (ISO 8601) |
| `tenantId` | string | No | No | Multi-tenant isolation |
| `organizationId` | string | No | No | Organization scope |

---

## Core Entities

### 1. User Entity

**Store Name**: `users`

```typescript
interface User extends BaseEntity {
  name: string;
  email: string;
  passwordHash: string;
  role: 'SuperAdmin' | 'OrgAdmin' | 'TenantAdmin' | 'Manager' | 'Analyst' | 'Engineer' | 'Operator';
  isActive: boolean;
}
```

**Database Schema**:
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's full name |
| email | string | Yes | Unique email address |
| passwordHash | string | Yes | Hashed password (bcrypt recommended) |
| role | enum | Yes | User role for RBAC |
| isActive | boolean | Yes | Account status flag |

**Roles Hierarchy**:
1. SuperAdmin - Full system access
2. OrgAdmin - Organization-level admin
3. TenantAdmin - Tenant-level admin
4. Manager - Management operations
5. Analyst - Analysis and reporting
6. Engineer - Engineering functions
7. Operator - Operational tasks

---

### 2. Organization Entity

**Store Name**: `organizations`

```typescript
interface Organization extends BaseEntity {
  name: string;
  code: string;
  description?: string;
}
```

**Database Schema**:
```sql
CREATE TABLE organizations (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Organization name |
| code | string | Yes | Unique organization code |
| description | string | No | Optional description |

---

### 3. Tenant Entity

**Store Name**: `tenants`

```typescript
interface Tenant extends BaseEntity {
  name: string;
  code: string;
  organizationId: string;
  description?: string;
}
```

**Database Schema**:
```sql
CREATE TABLE tenants (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Tenant name |
| code | string | Yes | Unique tenant code |
| organizationId | string | Yes | Parent organization ID |
| description | string | No | Optional description |

---

### 4. Unit Entity

**Store Name**: `units`

```typescript
interface Unit extends BaseEntity {
  name: string;
  code: string;
  tenantId: string;
  description?: string;
}
```

**Database Schema**:
```sql
CREATE TABLE units (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE KEY unique_unit_code_per_tenant (tenant_id, code)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unit/facility name |
| code | string | Yes | Unit code (unique per tenant) |
| tenantId | string | Yes | Parent tenant ID |
| description | string | No | Optional description |

---

### 5. Asset Entity

**Store Name**: `assets`

```typescript
interface Asset extends BaseEntity {
  name: string;
  code: string;
  unitId: string;
  description?: string;
}
```

**Database Schema**:
```sql
CREATE TABLE assets (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  unit_id VARCHAR(36) NOT NULL,
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  UNIQUE KEY unique_asset_code_per_unit (unit_id, code)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Asset name |
| code | string | Yes | Asset code (unique per unit) |
| unitId | string | Yes | Parent unit ID |
| description | string | No | Optional description |

---

### 6. Audit Log Entity

**Store Name**: `auditLogs`

```typescript
interface AuditLog extends BaseEntity {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: string;
}
```

**Database Schema**:
```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  details JSON,
  timestamp TIMESTAMP NOT NULL,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Yes | User who performed action |
| action | string | Yes | Action performed (create, update, delete, etc.) |
| entityType | string | Yes | Type of entity modified |
| entityId | string | Yes | ID of entity modified |
| details | object | Yes | JSON details of the change |
| timestamp | string | Yes | Action timestamp (ISO 8601) |

---

## Master Data Entities

### 7. Impact Codes

**Store Name**: `impactCodes`

**Database Schema**:
```sql
CREATE TABLE impact_codes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 8. OEE Codes

**Store Name**: `oeeCodes`

**Database Schema**:
```sql
CREATE TABLE oee_codes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 9. RCA Cause Codes

**Store Name**: `rcaCauseCodes`

**Database Schema**:
```sql
CREATE TABLE rca_cause_codes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 10. Verification Status Codes

**Store Name**: `verificationStatusCodes`

**Database Schema**:
```sql
CREATE TABLE verification_status_codes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 11. Reason Codes

**Store Name**: `reasonCodes`

**Database Schema**:
```sql
CREATE TABLE reason_codes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

## Production Entities

### 12. Products

**Store Name**: `products`

**Database Schema**:
```sql
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  unit_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  uom VARCHAR(50),
  standard_rate DECIMAL(15,4),
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_unit_id (unit_id)
);
```

---

### 13. Production Plans

**Store Name**: `productionPlans`

**Database Schema**:
```sql
CREATE TABLE production_plans (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  unit_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36),
  plan_name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  target_quantity DECIMAL(15,4),
  actual_quantity DECIMAL(15,4),
  status VARCHAR(50),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_unit_id (unit_id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

---

### 14. Production Plan Templates

**Store Name**: `productionPlanTemplates`

**Database Schema**:
```sql
CREATE TABLE production_plan_templates (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSON,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 15. Production Events

**Store Name**: `productionEvents`

**Indexes**: `unitId`, `status`

**Database Schema**:
```sql
CREATE TABLE production_events (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  unit_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(100),
  event_name VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INT,
  status VARCHAR(50),
  severity VARCHAR(50),
  impact_code_id VARCHAR(36),
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_unit_id (unit_id),
  INDEX idx_status (status),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

---

### 16. Production Losses

**Store Name**: `productionLosses`

**Indexes**: `planId`, `period`

**Database Schema**:
```sql
CREATE TABLE production_losses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  plan_id VARCHAR(36) NOT NULL,
  period VARCHAR(50),
  loss_type VARCHAR(100),
  loss_category VARCHAR(100),
  quantity DECIMAL(15,4),
  cost DECIMAL(15,2),
  description TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_plan_id (plan_id),
  INDEX idx_period (period),
  FOREIGN KEY (plan_id) REFERENCES production_plans(id)
);
```

---

### 17. OEE Summaries

**Store Name**: `oeeSummaries`

**Indexes**: `planId`, `period`

**Database Schema**:
```sql
CREATE TABLE oee_summaries (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  plan_id VARCHAR(36) NOT NULL,
  period VARCHAR(50),
  availability DECIMAL(5,2),
  performance DECIMAL(5,2),
  quality DECIMAL(5,2),
  oee DECIMAL(5,2),
  planned_production_time DECIMAL(10,2),
  actual_production_time DECIMAL(10,2),
  downtime DECIMAL(10,2),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_plan_id (plan_id),
  INDEX idx_period (period),
  FOREIGN KEY (plan_id) REFERENCES production_plans(id)
);
```

---

### 18. Reconcile Forms

**Store Name**: `reconcileForms`

**Indexes**: `lossId`, `status`

**Database Schema**:
```sql
CREATE TABLE reconcile_forms (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  loss_id VARCHAR(36) NOT NULL,
  status VARCHAR(50),
  submitted_by VARCHAR(36),
  submitted_at TIMESTAMP,
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMP,
  form_data JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_loss_id (loss_id),
  INDEX idx_status (status),
  FOREIGN KEY (loss_id) REFERENCES production_losses(id)
);
```

---

### 19. Loss Categories

**Store Name**: `lossCategories`

**Indexes**: `reconcileFormId`

**Database Schema**:
```sql
CREATE TABLE loss_categories (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  reconcile_form_id VARCHAR(36),
  category_name VARCHAR(255),
  category_type VARCHAR(100),
  value DECIMAL(15,4),
  percentage DECIMAL(5,2),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_reconcile_form_id (reconcile_form_id),
  FOREIGN KEY (reconcile_form_id) REFERENCES reconcile_forms(id)
);
```

---

### 20. Unmapped Events

**Store Name**: `unmappedEvents`

**Indexes**: `tenantId`, `unitId`, `createdAt`

**Database Schema**:
```sql
CREATE TABLE unmapped_events (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  unit_id VARCHAR(36),
  event_name VARCHAR(255),
  event_type VARCHAR(100),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  source_system VARCHAR(100),
  source_id VARCHAR(255),
  event_data JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_unit_id (unit_id)
);
```

---

## RCA Entities

### 21. RCAs (Root Cause Analyses)

**Store Name**: `rcas`

**Indexes**: `eventId`, `status`

**Database Schema**:
```sql
CREATE TABLE rcas (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  event_id VARCHAR(36),
  rca_number VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50),
  priority VARCHAR(50),
  assigned_to VARCHAR(36),
  team_members JSON,
  start_date TIMESTAMP,
  target_completion_date TIMESTAMP,
  actual_completion_date TIMESTAMP,
  root_cause TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_event_id (event_id),
  INDEX idx_status (status),
  FOREIGN KEY (event_id) REFERENCES production_events(id)
);
```

---

### 22. RCA Recommendations

**Store Name**: `rcaRecommendations`

**Database Schema**:
```sql
CREATE TABLE rca_recommendations (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  recommendation_text TEXT NOT NULL,
  priority VARCHAR(50),
  status VARCHAR(50),
  assigned_to VARCHAR(36),
  due_date TIMESTAMP,
  completion_date TIMESTAMP,
  cost_estimate DECIMAL(15,2),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 23. RCA Evidence

**Store Name**: `rcaEvidence`

**Database Schema**:
```sql
CREATE TABLE rca_evidence (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  evidence_type VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by VARCHAR(36),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 24. Logic Tree Nodes

**Store Name**: `logicTreeNodes`

**Database Schema**:
```sql
CREATE TABLE logic_tree_nodes (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  parent_node_id VARCHAR(36),
  node_type VARCHAR(50),
  label VARCHAR(255),
  description TEXT,
  level INT,
  position INT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  INDEX idx_parent_node_id (parent_node_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 25. RCA Trigger Configurations

**Store Name**: `rcaTriggerConfigs`

**Database Schema**:
```sql
CREATE TABLE rca_trigger_configs (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(100),
  conditions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  auto_create_rca BOOLEAN DEFAULT FALSE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 26. RCA Knowledge Base

**Store Name**: `rcaKnowledgeBase`

**Database Schema**:
```sql
CREATE TABLE rca_knowledge_base (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  tags JSON,
  content TEXT,
  related_rcas JSON,
  author VARCHAR(36),
  is_published BOOLEAN DEFAULT FALSE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 27. RCA Analysis Configurations

**Store Name**: `rcaAnalysisConfigs`

**Database Schema**:
```sql
CREATE TABLE rca_analysis_configs (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  analysis_type VARCHAR(100),
  config_name VARCHAR(255),
  config_data JSON,
  is_default BOOLEAN DEFAULT FALSE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 28. RCA Templates

**Store Name**: `rcaTemplates`

**Database Schema**:
```sql
CREATE TABLE rca_templates (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(100),
  template_data JSON,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 29. Evidence Categories

**Store Name**: `evidenceCategories`

**Database Schema**:
```sql
CREATE TABLE evidence_categories (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  category_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 30. Evidence Locations

**Store Name**: `evidenceLocations`

**Database Schema**:
```sql
CREATE TABLE evidence_locations (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

## Analysis Tool Entities

### 31. Five Why Analyses

**Store Name**: `fiveWhyAnalyses`

**Database Schema**:
```sql
CREATE TABLE five_why_analyses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  problem_statement TEXT,
  why_levels JSON,
  root_cause TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 32. Fishbone Diagrams

**Store Name**: `fishboneDiagrams`

**Database Schema**:
```sql
CREATE TABLE fishbone_diagrams (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  problem_statement TEXT,
  categories JSON,
  causes JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 33. FMEA Analyses

**Store Name**: `fmeaAnalyses`

**Database Schema**:
```sql
CREATE TABLE fmea_analyses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  analysis_name VARCHAR(255),
  failure_modes JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 34. Fault Tree Analyses

**Store Name**: `faultTreeAnalyses`

**Database Schema**:
```sql
CREATE TABLE fault_tree_analyses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  top_event TEXT,
  tree_data JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 35. Barrier Analyses

**Store Name**: `barrierAnalyses`

**Database Schema**:
```sql
CREATE TABLE barrier_analyses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  hazard TEXT,
  barriers JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

### 36. Change Analyses

**Store Name**: `changeAnalyses`

**Database Schema**:
```sql
CREATE TABLE change_analyses (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  rca_id VARCHAR(36) NOT NULL,
  change_description TEXT,
  changes JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_rca_id (rca_id),
  FOREIGN KEY (rca_id) REFERENCES rcas(id)
);
```

---

## PI Integration Entities

### 37. PI Connections

**Store Name**: `piConnections`

**Indexes**: `tenantId`

**Database Schema**:
```sql
CREATE TABLE pi_connections (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  connection_name VARCHAR(255) NOT NULL,
  pi_web_api_url VARCHAR(500) NOT NULL,
  username VARCHAR(255),
  password_encrypted TEXT,
  af_database_path VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_time TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 38. PI AF Elements

**Store Name**: `piAfElements`

**Indexes**: `parentId`, `template`

**Database Schema**:
```sql
CREATE TABLE pi_af_elements (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  web_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  description TEXT,
  path VARCHAR(1000),
  template VARCHAR(255),
  parent_id VARCHAR(36),
  has_children BOOLEAN DEFAULT FALSE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_parent_id (parent_id),
  INDEX idx_template (template),
  INDEX idx_web_id (web_id)
);
```

---

### 39. AF Bindings

**Store Name**: `afBindings`

**Indexes**: `tenantId`, `webId`, `boundType`, `localId`

**Database Schema**:
```sql
CREATE TABLE af_bindings (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  web_id VARCHAR(255),
  local_id VARCHAR(36),
  bound_type VARCHAR(100),
  mapping_config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_web_id (web_id),
  INDEX idx_bound_type (bound_type),
  INDEX idx_local_id (local_id)
);
```

---

### 40. PI Events

**Store Name**: `piEvents`

**Indexes**: `template`, `primaryAfId`, `startUtc`

**Database Schema**:
```sql
CREATE TABLE pi_events (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  web_id VARCHAR(255),
  name VARCHAR(255),
  template VARCHAR(255),
  primary_af_id VARCHAR(255),
  start_utc TIMESTAMP,
  end_utc TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  event_data JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_template (template),
  INDEX idx_primary_af_id (primary_af_id),
  INDEX idx_start_utc (start_utc)
);
```

---

### 41. PI Mappings

**Store Name**: `piMappings`

**Database Schema**:
```sql
CREATE TABLE pi_mappings (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  source_type VARCHAR(100),
  source_id VARCHAR(255),
  target_type VARCHAR(100),
  target_id VARCHAR(36),
  mapping_rules JSON,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 42. PI Sync Watermarks

**Store Name**: `piSyncWatermarks`

**Database Schema**:
```sql
CREATE TABLE pi_sync_watermarks (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  sync_type VARCHAR(100),
  last_sync_timestamp TIMESTAMP,
  last_sync_marker VARCHAR(255),
  sync_status VARCHAR(50),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 43. PI Sync Jobs

**Store Name**: `piSyncJobs`

**Database Schema**:
```sql
CREATE TABLE pi_sync_jobs (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  job_name VARCHAR(255),
  job_type VARCHAR(100),
  schedule VARCHAR(255),
  last_run_time TIMESTAMP,
  next_run_time TIMESTAMP,
  status VARCHAR(50),
  error_message TEXT,
  job_config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

### 44. Historian Tags

**Store Name**: `historianTags`

**Indexes**: `tenantId`, `webId`, `category`, `enabled`

**Database Schema**:
```sql
CREATE TABLE historian_tags (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  web_id VARCHAR(255),
  tag_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit_of_measure VARCHAR(50),
  data_type VARCHAR(50),
  enabled BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_web_id (web_id),
  INDEX idx_category (category),
  INDEX idx_enabled (enabled)
);
```

---

## Integration Entities

### 45. Data Sources

**Store Name**: `dataSources`

**Indexes**: `type`, `status`, `enabled`

**Database Schema**:
```sql
CREATE TABLE data_sources (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  source_name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  connection_string TEXT,
  credentials_encrypted TEXT,
  status VARCHAR(50),
  enabled BOOLEAN DEFAULT TRUE,
  last_sync_time TIMESTAMP,
  config JSON,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_enabled (enabled)
);
```

---

## Custom Attributes

### 46. Custom Attribute Definitions

**Store Name**: `customAttributeDefinitions`

**Indexes**: `entityType`, `tenantId`, `organizationId`

**Database Schema**:
```sql
CREATE TABLE custom_attribute_definitions (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  entity_type VARCHAR(100) NOT NULL,
  attribute_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  data_type VARCHAR(50),
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  validation_rules JSON,
  display_order INT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_entity_type (entity_type)
);
```

---

### 47. Custom Attribute Values

**Store Name**: `customAttributeValues`

**Indexes**: `entityId`, `entityType`, `attributeDefinitionId`

**Database Schema**:
```sql
CREATE TABLE custom_attribute_values (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  entity_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  attribute_definition_id VARCHAR(36) NOT NULL,
  value TEXT,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at),
  INDEX idx_entity_id (entity_id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_attribute_definition_id (attribute_definition_id),
  FOREIGN KEY (attribute_definition_id) REFERENCES custom_attribute_definitions(id)
);
```

---

### 48. Dashboard Configurations

**Store Name**: `dashboardConfigurations`

**Database Schema**:
```sql
CREATE TABLE dashboard_configurations (
  id VARCHAR(36) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(36),
  organization_id VARCHAR(36),
  dashboard_name VARCHAR(255) NOT NULL,
  dashboard_type VARCHAR(100),
  layout_config JSON,
  widget_config JSON,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);
```

---

## All Object Stores Summary

Complete list of 48 object stores in the system:

| # | Store Name | Key Path | Special Indexes |
|---|------------|----------|-----------------|
| 1 | appSettings | key | N/A |
| 2 | users | id | tenantId, organizationId, createdAt |
| 3 | organizations | id | tenantId, organizationId, createdAt |
| 4 | tenants | id | tenantId, organizationId, createdAt |
| 5 | units | id | tenantId, organizationId, createdAt |
| 6 | assets | id | tenantId, organizationId, createdAt |
| 7 | auditLogs | id | tenantId, organizationId, createdAt |
| 8 | impactCodes | id | tenantId, organizationId, createdAt |
| 9 | oeeCodes | id | tenantId, organizationId, createdAt |
| 10 | rcaCauseCodes | id | tenantId, organizationId, createdAt |
| 11 | verificationStatusCodes | id | tenantId, organizationId, createdAt |
| 12 | reasonCodes | id | tenantId, organizationId, createdAt |
| 13 | products | id | tenantId, organizationId, createdAt |
| 14 | productionPlans | id | tenantId, organizationId, createdAt |
| 15 | productionPlanTemplates | id | tenantId, organizationId, createdAt |
| 16 | productionEvents | id | tenantId, organizationId, createdAt, **unitId, status** |
| 17 | productionLosses | id | tenantId, organizationId, createdAt, **planId, period** |
| 18 | oeeSummaries | id | tenantId, organizationId, createdAt, **planId, period** |
| 19 | reconcileForms | id | tenantId, organizationId, createdAt, **lossId, status** |
| 20 | lossCategories | id | tenantId, organizationId, createdAt, **reconcileFormId** |
| 21 | unmappedEvents | id | tenantId, organizationId, createdAt, **unitId** |
| 22 | rcas | id | tenantId, organizationId, createdAt, **eventId, status** |
| 23 | rcaRecommendations | id | tenantId, organizationId, createdAt |
| 24 | rcaEvidence | id | tenantId, organizationId, createdAt |
| 25 | logicTreeNodes | id | tenantId, organizationId, createdAt |
| 26 | rcaTriggerConfigs | id | tenantId, organizationId, createdAt |
| 27 | rcaKnowledgeBase | id | tenantId, organizationId, createdAt |
| 28 | rcaAnalysisConfigs | id | tenantId, organizationId, createdAt |
| 29 | rcaTemplates | id | tenantId, organizationId, createdAt |
| 30 | evidenceCategories | id | tenantId, organizationId, createdAt |
| 31 | evidenceLocations | id | tenantId, organizationId, createdAt |
| 32 | fiveWhyAnalyses | id | tenantId, organizationId, createdAt |
| 33 | fishboneDiagrams | id | tenantId, organizationId, createdAt |
| 34 | fmeaAnalyses | id | tenantId, organizationId, createdAt |
| 35 | faultTreeAnalyses | id | tenantId, organizationId, createdAt |
| 36 | barrierAnalyses | id | tenantId, organizationId, createdAt |
| 37 | changeAnalyses | id | tenantId, organizationId, createdAt |
| 38 | piConnections | id | **tenantId**, organizationId, createdAt |
| 39 | piAfElements | id | tenantId, organizationId, createdAt, **parentId, template** |
| 40 | afBindings | id | **tenantId, webId, boundType, localId**, organizationId, createdAt |
| 41 | piEvents | id | tenantId, organizationId, createdAt, **template, primaryAfId, startUtc** |
| 42 | piMappings | id | tenantId, organizationId, createdAt |
| 43 | piSyncWatermarks | id | tenantId, organizationId, createdAt |
| 44 | piSyncJobs | id | tenantId, organizationId, createdAt |
| 45 | historianTags | id | **tenantId, webId, category, enabled**, organizationId, createdAt |
| 46 | dataSources | id | tenantId, organizationId, createdAt, **type, status, enabled** |
| 47 | customAttributeDefinitions | id | **entityType, tenantId**, organizationId, createdAt |
| 48 | customAttributeValues | id | tenantId, organizationId, createdAt, **entityId, entityType, attributeDefinitionId** |
| 49 | dashboardConfigurations | id | tenantId, organizationId, createdAt |

---

## Indexes Reference

### Standard Indexes (Applied to all stores except appSettings)

```sql
INDEX idx_tenant_id (tenant_id)
INDEX idx_organization_id (organization_id)
INDEX idx_created_at (created_at)
```

### Store-Specific Indexes

#### productionEvents
```sql
INDEX idx_unit_id (unit_id)
INDEX idx_status (status)
```

#### rcas
```sql
INDEX idx_event_id (event_id)
INDEX idx_status (status)
```

#### productionLosses
```sql
INDEX idx_plan_id (plan_id)
INDEX idx_period (period)
```

#### oeeSummaries
```sql
INDEX idx_plan_id (plan_id)
INDEX idx_period (period)
```

#### reconcileForms
```sql
INDEX idx_loss_id (loss_id)
INDEX idx_status (status)
```

#### lossCategories
```sql
INDEX idx_reconcile_form_id (reconcile_form_id)
```

#### unmappedEvents
```sql
INDEX idx_tenant_id (tenant_id)
INDEX idx_unit_id (unit_id)
INDEX idx_created_at (created_at)
```

#### piConnections
```sql
INDEX idx_tenant_id (tenant_id)
```

#### customAttributeDefinitions
```sql
INDEX idx_entity_type (entity_type)
INDEX idx_tenant_id (tenant_id)
INDEX idx_organization_id (organization_id)
```

#### customAttributeValues
```sql
INDEX idx_entity_id (entity_id)
INDEX idx_entity_type (entity_type)
INDEX idx_attribute_definition_id (attribute_definition_id)
```

#### piAfElements
```sql
INDEX idx_parent_id (parent_id)
INDEX idx_template (template)
```

#### afBindings
```sql
INDEX idx_tenant_id (tenant_id)
INDEX idx_web_id (web_id)
INDEX idx_bound_type (bound_type)
INDEX idx_local_id (local_id)
```

#### piEvents
```sql
INDEX idx_template (template)
INDEX idx_primary_af_id (primary_af_id)
INDEX idx_start_utc (start_utc)
```

#### historianTags
```sql
INDEX idx_tenant_id (tenant_id)
INDEX idx_web_id (web_id)
INDEX idx_category (category)
INDEX idx_enabled (enabled)
```

#### dataSources
```sql
INDEX idx_type (type)
INDEX idx_status (status)
INDEX idx_enabled (enabled)
```

---

## CRUD Operations

### 1. Create Operation

**Method**: `create<T>(storeName: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>)`

**Behavior**:
- Generates UUID for `id` using `crypto.randomUUID()`
- Sets `createdAt` to current ISO timestamp
- Sets `updatedAt` to current ISO timestamp
- Emits real-time update event

**Backend Implementation**:
```javascript
POST /api/{storeName}

Request Body: {
  // Entity fields (excluding id, createdAt, updatedAt)
}

Response: {
  id: "uuid",
  createdAt: "2025-10-18T12:00:00.000Z",
  updatedAt: "2025-10-18T12:00:00.000Z",
  ...requestData
}
```

**Example**:
```javascript
// Frontend call
await storageService.create('users', {
  name: 'John Doe',
  email: 'john@example.com',
  passwordHash: 'hashed_password',
  role: 'Manager',
  isActive: true,
  tenantId: 'tenant-123',
  organizationId: 'org-456'
});

// Backend endpoint
POST /api/users
{
  "name": "John Doe",
  "email": "john@example.com",
  "passwordHash": "hashed_password",
  "role": "Manager",
  "isActive": true,
  "tenantId": "tenant-123",
  "organizationId": "org-456"
}
```

---

### 2. Get Operation

**Method**: `get<T>(storeName: string, id: string)`

**Behavior**:
- Returns single entity by ID
- Returns null if not found

**Backend Implementation**:
```javascript
GET /api/{storeName}/{id}

Response: {
  id: "uuid",
  createdAt: "timestamp",
  updatedAt: "timestamp",
  ...entityFields
} | null
```

**Example**:
```javascript
GET /api/users/abc-123
```

---

### 3. Update Operation

**Method**: `update<T>(storeName: string, id: string, updates: Partial<T>)`

**Behavior**:
- Merges updates with existing entity
- Updates `updatedAt` timestamp
- Returns updated entity
- Throws error if entity not found
- Emits real-time update event

**Backend Implementation**:
```javascript
PATCH /api/{storeName}/{id}

Request Body: {
  // Partial entity fields to update
}

Response: {
  ...existingFields,
  ...updates,
  updatedAt: "new_timestamp"
}
```

**Example**:
```javascript
PATCH /api/users/abc-123
{
  "name": "John Smith",
  "isActive": false
}
```

---

### 4. Delete Operation

**Method**: `delete(storeName: string, id: string)`

**Behavior**:
- Deletes entity by ID
- Emits real-time update event
- No error if entity doesn't exist

**Backend Implementation**:
```javascript
DELETE /api/{storeName}/{id}

Response: 204 No Content
```

**Example**:
```javascript
DELETE /api/users/abc-123
```

---

### 5. Query Operation

**Method**: `query<T>(storeName: string, filters?: { tenantId?, organizationId?, unitId?, status?, planId?, period?, lossId? })`

**Behavior**:
- Returns array of entities
- Applies filters if provided
- Returns all entities if no filters

**Backend Implementation**:
```javascript
GET /api/{storeName}?tenantId={value}&organizationId={value}&unitId={value}&status={value}&planId={value}&period={value}&lossId={value}

Response: [
  { ...entity1 },
  { ...entity2 }
]
```

**Supported Filters**:
| Filter | Type | Description |
|--------|------|-------------|
| tenantId | string | Filter by tenant |
| organizationId | string | Filter by organization |
| unitId | string | Filter by unit |
| status | string | Filter by status |
| planId | string | Filter by plan |
| period | string | Filter by period |
| lossId | string | Filter by loss |

**Example**:
```javascript
GET /api/productionEvents?tenantId=tenant-123&status=active&unitId=unit-456
```

---

### 6. Audit Log Operation

**Method**: `logAudit(userId: string, action: string, entityType: string, entityId: string, details: Record<string, any>)`

**Behavior**:
- Creates audit log entry
- Sets timestamp automatically

**Backend Implementation**:
```javascript
POST /api/audit-logs

Request Body: {
  "userId": "user-id",
  "action": "create|update|delete",
  "entityType": "users",
  "entityId": "entity-id",
  "details": { ...changeDetails }
}
```

**Recommended Actions**:
- `create` - Entity created
- `update` - Entity updated
- `delete` - Entity deleted
- `login` - User login
- `logout` - User logout
- `export` - Data exported
- `import` - Data imported

---

### 7. App Settings Operations

**Methods**:
- `setAppSetting(key: string, value: any)` - Set key-value pair
- `getAppSetting<T>(key: string)` - Get value by key

**Backend Implementation**:
```javascript
// Set setting
PUT /api/settings/{key}
Request Body: {
  "value": any
}

// Get setting
GET /api/settings/{key}
Response: {
  "key": "setting-key",
  "value": any
} | null
```

**Example**:
```javascript
PUT /api/settings/theme
{
  "value": "dark"
}

GET /api/settings/theme
{
  "key": "theme",
  "value": "dark"
}
```

---

### 8. Unmapped Events Operations

**Dedicated Methods**:
- `createUnmappedEvent(data)` - Create unmapped event
- `getUnmappedEvent(id)` - Get unmapped event
- `updateUnmappedEvent(id, updates)` - Update unmapped event
- `deleteUnmappedEvent(id)` - Delete unmapped event
- `queryUnmappedEvents(filters?)` - Query unmapped events

**Backend Implementation**:
```javascript
POST /api/unmapped-events
GET /api/unmapped-events/{id}
PATCH /api/unmapped-events/{id}
DELETE /api/unmapped-events/{id}
GET /api/unmapped-events?tenantId={value}&unitId={value}
```

---

## Real-Time Event System

### Event Broadcasting

**Frontend Behavior**:
- Emits `dataUpdate` custom event on window object
- Triggered on: create, update, delete operations

**Event Structure**:
```typescript
{
  storeName: string,      // Name of the store
  action: string,         // 'create', 'update', or 'delete'
  data: any,             // Entity data
  timestamp: string      // ISO timestamp
}
```

### Backend Implementation Options

#### Option 1: WebSocket
```javascript
// Server-side
io.emit('dataUpdate', {
  storeName: 'users',
  action: 'create',
  data: { ...entity },
  timestamp: new Date().toISOString()
});

// Client-side listener
socket.on('dataUpdate', (event) => {
  console.log('Real-time update:', event);
});
```

#### Option 2: Server-Sent Events (SSE)
```javascript
// Server endpoint
GET /api/events/stream

// Response format
event: dataUpdate
data: {"storeName":"users","action":"create","data":{...},"timestamp":"..."}
```

#### Option 3: Polling
```javascript
// Poll endpoint every N seconds
GET /api/events/since?timestamp={lastPollTime}

Response: [
  {
    storeName: 'users',
    action: 'update',
    data: {...},
    timestamp: '...'
  }
]
```

### Listener Registration

**Frontend Method**: `onUpdate(callback)`

**Backend WebSocket Example**:
```javascript
// Client subscribes
socket.emit('subscribe', { tenantId: 'tenant-123' });

// Server filters events by tenant
socket.on('dataUpdate', (event) => {
  if (event.tenantId === userTenantId) {
    // Handle update
  }
});
```

---

## Historian History Database

Separate database for historian query history tracking.

### Configuration

- **Database Name**: `ProActHistorianDB`
- **Version**: `1`
- **Store Name**: `queryHistory`
- **Key Path**: `id`

### Schema

```typescript
interface QueryHistoryEntry {
  id: string;
  timestamp: string;
  attributes: any[];
  queryParams: any;
  resultCount: number;
  tenantId: string;
}
```

**SQL Schema**:
```sql
CREATE TABLE query_history (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  attributes JSON NOT NULL,
  query_params JSON NOT NULL,
  result_count INT NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_timestamp (timestamp)
);
```

### Methods

#### 1. Initialize
```javascript
await historianHistoryDB.init();
```

#### 2. Save Query History
```javascript
await historianHistoryDB.saveQueryHistory(tenantId, history);

// Backend
PUT /api/historian/history/{tenantId}
Body: [
  {
    id: "...",
    timestamp: "...",
    attributes: [...],
    queryParams: {...},
    resultCount: 100
  }
]
```

#### 3. Load Query History
```javascript
const history = await historianHistoryDB.loadQueryHistory(tenantId);

// Backend
GET /api/historian/history/{tenantId}
Response: [
  {
    id: "...",
    timestamp: "...",
    attributes: [...],
    queryParams: {...},
    resultCount: 100,
    tenantId: "..."
  }
]
```

#### 4. Add Query History Entry
```javascript
await historianHistoryDB.addQueryHistoryEntry(tenantId, entry);

// Backend
POST /api/historian/history/{tenantId}
Body: {
  id: "...",
  timestamp: "...",
  attributes: [...],
  queryParams: {...},
  resultCount: 100
}
```

**Automatic Limiting**:
- Keeps only last 20 entries
- Sorted by timestamp descending (most recent first)

#### 5. Remove Query History Entry
```javascript
await historianHistoryDB.removeQueryHistoryEntry(id);

// Backend
DELETE /api/historian/history/entry/{id}
```

#### 6. Clear Query History
```javascript
await historianHistoryDB.clearQueryHistory(tenantId);

// Backend
DELETE /api/historian/history/{tenantId}
```

#### 7. Export Query History
```javascript
const exported = await historianHistoryDB.exportQueryHistory(tenantId);

// Backend
GET /api/historian/history/{tenantId}/export
Response: [
  {
    timestamp: "...",
    attributes: 5,
    mode: "interpolated",
    startTime: "...",
    endTime: "...",
    resultCount: 100,
    attributeNames: "Tag1, Tag2, Tag3"
  }
]
```

#### 8. Import Query History
```javascript
await historianHistoryDB.importQueryHistory(tenantId, importedData);

// Backend
POST /api/historian/history/{tenantId}/import
Body: [
  {
    id: "...",
    timestamp: "...",
    attributes: [...],
    queryParams: {...},
    resultCount: 100
  }
]
```

### Fallback Storage

**Behavior**:
- If IndexedDB unavailable, uses in-memory Map
- Same API surface
- Data lost on page refresh

**Backend Notes**:
- Always use persistent database storage
- No fallback needed on server

### Utility Methods

#### Check IndexedDB Availability
```javascript
const available = historianHistoryDB.isIndexedDBAvailable();
```

#### Check Database Ready State
```javascript
const ready = historianHistoryDB.isReady;
```

#### Get Storage Type
```javascript
const type = historianHistoryDB.getStorageType(); // 'indexeddb' | 'fallback'
```

#### Force Database Recreation
```javascript
await historianHistoryDB.forceDatabaseRecreation();

// Backend
POST /api/historian/history/recreate
```

---

## API Endpoints Mapping

### Complete REST API Structure

```
# Core Entities
POST   /api/users
GET    /api/users/{id}
GET    /api/users?tenantId={}&organizationId={}
PATCH  /api/users/{id}
DELETE /api/users/{id}

POST   /api/organizations
GET    /api/organizations/{id}
GET    /api/organizations
PATCH  /api/organizations/{id}
DELETE /api/organizations/{id}

POST   /api/tenants
GET    /api/tenants/{id}
GET    /api/tenants?organizationId={}
PATCH  /api/tenants/{id}
DELETE /api/tenants/{id}

POST   /api/units
GET    /api/units/{id}
GET    /api/units?tenantId={}
PATCH  /api/units/{id}
DELETE /api/units/{id}

POST   /api/assets
GET    /api/assets/{id}
GET    /api/assets?unitId={}
PATCH  /api/assets/{id}
DELETE /api/assets/{id}

POST   /api/audit-logs
GET    /api/audit-logs/{id}
GET    /api/audit-logs?userId={}&entityType={}&startDate={}&endDate={}
PATCH  /api/audit-logs/{id}
DELETE /api/audit-logs/{id}

# Master Data
POST   /api/impact-codes
GET    /api/impact-codes
PATCH  /api/impact-codes/{id}
DELETE /api/impact-codes/{id}

POST   /api/oee-codes
GET    /api/oee-codes
PATCH  /api/oee-codes/{id}
DELETE /api/oee-codes/{id}

POST   /api/rca-cause-codes
GET    /api/rca-cause-codes
PATCH  /api/rca-cause-codes/{id}
DELETE /api/rca-cause-codes/{id}

POST   /api/verification-status-codes
GET    /api/verification-status-codes
PATCH  /api/verification-status-codes/{id}
DELETE /api/verification-status-codes/{id}

POST   /api/reason-codes
GET    /api/reason-codes
PATCH  /api/reason-codes/{id}
DELETE /api/reason-codes/{id}

# Production
POST   /api/products
GET    /api/products?unitId={}
PATCH  /api/products/{id}
DELETE /api/products/{id}

POST   /api/production-plans
GET    /api/production-plans?unitId={}&status={}
PATCH  /api/production-plans/{id}
DELETE /api/production-plans/{id}

POST   /api/production-plan-templates
GET    /api/production-plan-templates
PATCH  /api/production-plan-templates/{id}
DELETE /api/production-plan-templates/{id}

POST   /api/production-events
GET    /api/production-events?unitId={}&status={}
PATCH  /api/production-events/{id}
DELETE /api/production-events/{id}

POST   /api/production-losses
GET    /api/production-losses?planId={}&period={}
PATCH  /api/production-losses/{id}
DELETE /api/production-losses/{id}

POST   /api/oee-summaries
GET    /api/oee-summaries?planId={}&period={}
PATCH  /api/oee-summaries/{id}
DELETE /api/oee-summaries/{id}

POST   /api/reconcile-forms
GET    /api/reconcile-forms?lossId={}&status={}
PATCH  /api/reconcile-forms/{id}
DELETE /api/reconcile-forms/{id}

POST   /api/loss-categories
GET    /api/loss-categories?reconcileFormId={}
PATCH  /api/loss-categories/{id}
DELETE /api/loss-categories/{id}

POST   /api/unmapped-events
GET    /api/unmapped-events?tenantId={}&unitId={}
PATCH  /api/unmapped-events/{id}
DELETE /api/unmapped-events/{id}

# RCA
POST   /api/rcas
GET    /api/rcas?eventId={}&status={}
PATCH  /api/rcas/{id}
DELETE /api/rcas/{id}

POST   /api/rca-recommendations
GET    /api/rca-recommendations?rcaId={}
PATCH  /api/rca-recommendations/{id}
DELETE /api/rca-recommendations/{id}

POST   /api/rca-evidence
GET    /api/rca-evidence?rcaId={}
PATCH  /api/rca-evidence/{id}
DELETE /api/rca-evidence/{id}

POST   /api/logic-tree-nodes
GET    /api/logic-tree-nodes?rcaId={}
PATCH  /api/logic-tree-nodes/{id}
DELETE /api/logic-tree-nodes/{id}

POST   /api/rca-trigger-configs
GET    /api/rca-trigger-configs
PATCH  /api/rca-trigger-configs/{id}
DELETE /api/rca-trigger-configs/{id}

POST   /api/rca-knowledge-base
GET    /api/rca-knowledge-base?category={}
PATCH  /api/rca-knowledge-base/{id}
DELETE /api/rca-knowledge-base/{id}

POST   /api/rca-analysis-configs
GET    /api/rca-analysis-configs?analysisType={}
PATCH  /api/rca-analysis-configs/{id}
DELETE /api/rca-analysis-configs/{id}

POST   /api/rca-templates
GET    /api/rca-templates
PATCH  /api/rca-templates/{id}
DELETE /api/rca-templates/{id}

POST   /api/evidence-categories
GET    /api/evidence-categories
PATCH  /api/evidence-categories/{id}
DELETE /api/evidence-categories/{id}

POST   /api/evidence-locations
GET    /api/evidence-locations
PATCH  /api/evidence-locations/{id}
DELETE /api/evidence-locations/{id}

# Analysis Tools
POST   /api/five-why-analyses
GET    /api/five-why-analyses?rcaId={}
PATCH  /api/five-why-analyses/{id}
DELETE /api/five-why-analyses/{id}

POST   /api/fishbone-diagrams
GET    /api/fishbone-diagrams?rcaId={}
PATCH  /api/fishbone-diagrams/{id}
DELETE /api/fishbone-diagrams/{id}

POST   /api/fmea-analyses
GET    /api/fmea-analyses?rcaId={}
PATCH  /api/fmea-analyses/{id}
DELETE /api/fmea-analyses/{id}

POST   /api/fault-tree-analyses
GET    /api/fault-tree-analyses?rcaId={}
PATCH  /api/fault-tree-analyses/{id}
DELETE /api/fault-tree-analyses/{id}

POST   /api/barrier-analyses
GET    /api/barrier-analyses?rcaId={}
PATCH  /api/barrier-analyses/{id}
DELETE /api/barrier-analyses/{id}

POST   /api/change-analyses
GET    /api/change-analyses?rcaId={}
PATCH  /api/change-analyses/{id}
DELETE /api/change-analyses/{id}

# PI Integration
POST   /api/pi-connections
GET    /api/pi-connections?tenantId={}
PATCH  /api/pi-connections/{id}
DELETE /api/pi-connections/{id}

POST   /api/pi-af-elements
GET    /api/pi-af-elements?parentId={}&template={}
PATCH  /api/pi-af-elements/{id}
DELETE /api/pi-af-elements/{id}

POST   /api/af-bindings
GET    /api/af-bindings?tenantId={}&boundType={}&localId={}
PATCH  /api/af-bindings/{id}
DELETE /api/af-bindings/{id}

POST   /api/pi-events
GET    /api/pi-events?template={}&primaryAfId={}&startUtc={}
PATCH  /api/pi-events/{id}
DELETE /api/pi-events/{id}

POST   /api/pi-mappings
GET    /api/pi-mappings?sourceType={}&targetType={}
PATCH  /api/pi-mappings/{id}
DELETE /api/pi-mappings/{id}

POST   /api/pi-sync-watermarks
GET    /api/pi-sync-watermarks?syncType={}
PATCH  /api/pi-sync-watermarks/{id}
DELETE /api/pi-sync-watermarks/{id}

POST   /api/pi-sync-jobs
GET    /api/pi-sync-jobs?status={}
PATCH  /api/pi-sync-jobs/{id}
DELETE /api/pi-sync-jobs/{id}

POST   /api/historian-tags
GET    /api/historian-tags?tenantId={}&category={}&enabled={}
PATCH  /api/historian-tags/{id}
DELETE /api/historian-tags/{id}

# Integration
POST   /api/data-sources
GET    /api/data-sources?type={}&status={}&enabled={}
PATCH  /api/data-sources/{id}
DELETE /api/data-sources/{id}

# Custom Attributes
POST   /api/custom-attribute-definitions
GET    /api/custom-attribute-definitions?entityType={}
PATCH  /api/custom-attribute-definitions/{id}
DELETE /api/custom-attribute-definitions/{id}

POST   /api/custom-attribute-values
GET    /api/custom-attribute-values?entityId={}&entityType={}&attributeDefinitionId={}
PATCH  /api/custom-attribute-values/{id}
DELETE /api/custom-attribute-values/{id}

# Dashboard
POST   /api/dashboard-configurations
GET    /api/dashboard-configurations?tenantId={}
PATCH  /api/dashboard-configurations/{id}
DELETE /api/dashboard-configurations/{id}

# Settings
PUT    /api/settings/{key}
GET    /api/settings/{key}
GET    /api/settings
DELETE /api/settings/{key}

# Historian History
PUT    /api/historian/history/{tenantId}
GET    /api/historian/history/{tenantId}
POST   /api/historian/history/{tenantId}
DELETE /api/historian/history/entry/{id}
DELETE /api/historian/history/{tenantId}
GET    /api/historian/history/{tenantId}/export
POST   /api/historian/history/{tenantId}/import
POST   /api/historian/history/recreate

# Real-time Events
GET    /api/events/stream (SSE)
GET    /api/events/since?timestamp={} (Polling)
WS     /ws/events (WebSocket)
```

---

## Additional Backend Considerations

### 1. Authentication & Authorization
- Implement JWT or session-based auth
- Role-based access control (RBAC) based on User.role
- Tenant isolation in all queries

### 2. Multi-Tenancy
- Always filter by tenantId in queries
- Validate tenant access in middleware
- Index all foreign keys for performance

### 3. Timestamps
- Use UTC for all timestamps
- Format: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
- Auto-update `updatedAt` on modifications

### 4. Data Validation
- Validate all required fields
- Enforce unique constraints (email, codes per tenant)
- Validate foreign key references

### 5. Error Handling
```javascript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email already exists",
    "field": "email"
  }
}
```

### 6. Pagination
```javascript
GET /api/users?page=1&limit=50&tenantId={}

Response: {
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "totalPages": 5
  }
}
```

### 7. Sorting
```javascript
GET /api/users?sortBy=createdAt&sortOrder=desc
```

### 8. Bulk Operations
```javascript
POST /api/users/bulk
Body: [
  { name: "User 1", ... },
  { name: "User 2", ... }
]

DELETE /api/users/bulk
Body: {
  ids: ["id1", "id2", "id3"]
}
```

### 9. Soft Deletes (Optional)
Add `deletedAt` field to enable soft deletes:
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
```

### 10. Audit Trail
- Log all create/update/delete operations to audit_logs table
- Include user_id, action, before/after values
- Retention policy for audit logs

---

## Implementation Checklist

- [ ] Set up database with all 49 tables
- [ ] Create indexes as specified
- [ ] Implement UUID generation
- [ ] Implement automatic timestamp handling
- [ ] Create REST API endpoints for all stores
- [ ] Implement query filtering
- [ ] Set up audit logging
- [ ] Implement real-time events (WebSocket/SSE)
- [ ] Add authentication & authorization
- [ ] Implement multi-tenant isolation
- [ ] Add input validation
- [ ] Implement error handling
- [ ] Add pagination support
- [ ] Set up historian history endpoints
- [ ] Implement bulk operations
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Set up monitoring and logging
- [ ] Implement rate limiting
- [ ] Add caching layer (Redis)
- [ ] Set up backup and recovery

---

## Version History

| Version | Changes |
|---------|---------|
| 19 | Added piSyncJobs store for automated event syncing |
| 18 | Added custom attributes support |
| 17 | Added PI integration stores |
| 16 | Added dashboard configurations |
| 15 | Added unmapped events |

---

## Support & Contact

For questions or clarifications about this backend reference:
- Review the source file: `src/services/StorageService.ts`
- Check related documentation in the docs/ folder
- Consult API_REFERENCE.md for additional details

---

**Document Version**: 1.0  
**Last Updated**: October 18, 2025  
**Based on**: StorageService.ts (IndexedDB Version 19)

