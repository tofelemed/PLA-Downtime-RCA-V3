You are to build a full-featured industrial SaaS web application named **Pro-Act**. It is a **modular, enterprise-grade platform** for managing production loss and root cause analysis (RCA) in industrial environments.

This application must be built as a **React + TailwindCSS Single Page Application (SPA)** with **IndexedDB as the client-side data store**. The data access layer should be built **modularly** so that we can **later swap IndexedDB with backend APIs** without needing to refactor the UI. Use a dedicated `StorageService` abstraction (React hooks, class, or service pattern) to wrap all IndexedDB calls.

We are **not implementing AI Assistant** in this version. In the **connectivity section**, do not integrate Aveva PI or CMMS—just add simulated inputs with placeholders for real integration later.

The application should support:
- **Multi-tenancy**
- **User Role-based Access Control**
- **Production loss ingestion**
- **Structured RCA**
- **Real-time RCA collaboration (simulated)**
- **Offline support via PWA**

Follow the **phased architecture below**. Do not skip any modules unless explicitly told.

---

### 📁 PHASE 1: Multitenant Core & User Management

#### Functional Requirements:
- Implement Organization > Tenant (Plant) > Unit > Asset hierarchy.
- User roles:
  - SuperAdmin: Manage all orgs, tenants, users
  - OrgAdmin: Manage a single org and its tenants
  - TenantAdmin: Manage users & settings for a single tenant
  - Analyst/Engineer: Can perform analysis, see RCA/FMEA
  - Operator: Limited to data entry and event acknowledgment
- User Model:
  - `{ id, name, email, passwordHash, role, organizationId, tenantId, isActive, createdAt }`
- Auth: Use simulated login with JWT-style session object. Store session data with role, org, and tenant context.
- Role-based routing.
- Plant Selector:
  - Tree view in header or sidebar: Organization > Tenant > Unit > (optional Asset)
  - Breadcrumb for selected path
- Audit log: Log all user actions (context: org, tenant, timestamp)

---

### 📁 PHASE 2: Master Data & Admin Settings

Create full CRUD UIs for the following admin modules. Respect role-based access.

- **Codes**:
  - Impact Codes
  - OEE Codes
  - RCA Cause Codes
  - Verification Status Codes

- **Products**:
  - Product catalog per org
  - Fields: `name`, `code`, `unitOfMeasure`, `description`

- **Production Units**:
  - Create/manage Units under each Tenant
  - Link optional assets under each Unit

- **Plan Templates**:
  - Template builder for Production Plans (name, schedule, units, target output)

- **RCA Settings**:
  - RCA Templates
  - Cause Libraries (FMEA style)
  - Verification Checklist templates

- **Connectivity (Placeholder only)**:
  - UI page to define Aveva PI config and CMMS credentials (form only)
  - No real API integration. Use dummy state.

---

### 📁 PHASE 3: Role-Based Dashboards

Show different dashboards based on user role and context:

- **Plant Manager**:
  - Financial KPIs
  - Open production losses
  - ROI summaries

- **Engineer**:
  - Asset health scores
  - Open RCA investigations
  - Tasks assigned

- **Operator**:
  - Assigned tasks
  - Event creation panel

All widgets should auto-refresh based on selected Plant > Unit.

---

### 📁 PHASE 4: Event Hub – Production Loss Ingestion

- Unified event list: all events for selected Unit
- Simulated ingestion from Aveva PI Event Frames:
  - Auto-create dummy events with: `id, startTime, endTime, asset, impactCode, oeeCode, source='Simulated PI'`
- Manual event creation (by Operator)
- Event detail view:
  - Full metadata
  - Attachments (e.g., notes, pictures)
  - Linked RCA
- Production Plans view:
  - Show planned vs. actual output
  - Reconcile losses (select Impact/OEE codes)

---

### 📁 PHASE 5: RCA Module

Implement a fully collaborative RCA builder:

- RCA Lifecycle:
  - Status: In Progress → Published
  - Sections:
    1. Definition: Event title, team charter, add RCA team
    2. Preserve: Evidence collection (offline-capable), photos, time-series
    3. Analyze: Logic Tree Builder
    4. Communicate: Recommendations
    5. Track: Performance Monitoring

- Real-time RCA Workspace:
  - Multi-user cursor simulation
  - Comments and @mentions
  - Verified hypotheses highlight causal chain

- Evidence:
  - Field operator uploads (simulate mobile capture with PWA)
  - Attach dummy time-series snapshot to asset (simulate historian)

- Recommendations:
  - Create recommendation items
  - Simulate "Push to CMMS" modal (no real API)

- RCA Templates:
  - RCA templates and logic tree structures preloaded per org

---

### 📁 PHASE 6: CMMS Integration (Simulated)

- Recommendations page:
  - Link to CMMS work order (text only)
  - Push to CMMS: show modal form (simulate API submission)
  - Store `cmmsWorkOrderId`, `status`

- Integration Status Dashboard:
  - List recent "pushes"
  - Show dummy sync statuses

---

### 📁 PHASE 7: Tracking & Effectiveness

- Recommendation Effectiveness Tracking:
  - For each RCA, track KPIs (pre/post-failure rate)
  - Show performance trend
  - Calculate simulated ROI: `$saved = deltaFailureRate * costPerFailure`

---

### 📁 PHASE 8: Real-Time Collaboration Simulation

- Simulate RCA team collaboration:
  - See other users’ cursors
  - Real-time update syncing via IndexedDB events
  - Shared tasks & status updates

---

### 🧩 Offline-First Requirements

- Enable PWA support
- Use IndexedDB for offline data storage
- Offline event/RCA creation
- Queue changes and sync when online

---

### 🗃️ IndexedDB Architecture Notes

- Use a dedicated `storageService` or `useDataStore` hook
- This service should support:
  - `get`, `set`, `update`, `delete`, `query` functions
  - Emit events on update (for simulated collaboration)
  - Namespaced per entity type (e.g., `rca`, `event`, `user`)
  - Data tagged with `tenantId`, `orgId`, and `updatedAt`
- Must be **modular** so it can be replaced with REST/GraphQL APIs later

---

### 🔐 Security and Access Control

- Store session (role/org/tenant) securely in memory
- Each page/component should:
  - Check role access before render
  - Filter all IndexedDB queries by `tenantId`, `orgId`
- All user actions should be logged (Audit Log)

---

### ✅ Deliverables Checklist

1. Fully modular React + Tailwind SPA
2. All modules: User Management, Codes, Products, Units, Plans, RCA, Event Hub, Tracking
3. IndexedDB via modular storage layer
4. PWA ready
5. Audit Log support
6. Multitenant context awareness
7. Real-time RCA workspace (simulated)
8. Dashboards per role
9. No AI Assistant
10. Connectivity config screen (placeholder only)

---

IMPORTANT:
- Do not skip any modules.
- Keep UI clean, modern, minimal.
- All modules must enforce dependency chain. Example:
  - RCA cannot be created if Event not coded.
  - Plan cannot be created without template.
  - RCA logic tree cannot be accessed unless team is defined.

---
