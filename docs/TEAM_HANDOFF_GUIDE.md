# ProAct Application — Team Handoff & Continuation Guide

> **Purpose:** Single reference for engineers joining or continuing work on ProAct.  
> **Last updated:** July 2026  
> **Repository:** `pro-act` (monorepo: React frontend + NestJS backend + MSSQL database)

---

## Table of Contents

1. [What Is ProAct?](#1-what-is-proact)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Getting Started (Local Development)](#4-getting-started-local-development)
5. [Project Structure](#5-project-structure)
6. [Authentication & Multi-Tenancy](#6-authentication--multi-tenancy)
7. [Module Reference (All Modules)](#7-module-reference-all-modules)
8. [Key User Workflows](#8-key-user-workflows)
9. [API & Integration Map](#9-api--integration-map)
10. [Real-Time & WebSockets](#10-real-time--websockets)
11. [Testing](#11-testing)
12. [Database](#12-database)
13. [Configuration & Environment Variables](#13-configuration--environment-variables)
14. [Known Issues & Gotchas](#14-known-issues--gotchas)
15. [What Remains for a Full Production Application](#15-what-remains-for-a-full-production-application)
16. [Recommended Roadmap (Priority Order)](#16-recommended-roadmap-priority-order)
17. [Quick File Reference](#17-quick-file-reference)

---

## 1. What Is ProAct?

**ProAct** is a production intelligence and loss-analysis platform for manufacturing / process industries. It helps teams:

- Manage **production plans**, **events**, and **losses**
- Calculate and visualize **OEE** (Overall Equipment Effectiveness)
- Run **Root Cause Analysis (RCA)** with recommendations and linked tasks
- Pull events from **PI System** and industrial **connectivity** sources
- Track **audit trails** and **tasks**
- Generate **reports** across OEE, losses, RCA, audit, and tasks

### Primary Personas

| Persona | Main screens |
|---------|----------------|
| Operator | Event Hub, Dashboard |
| Production Engineer | Production Plans, Plan Dashboard, PLA Analytics |
| Reliability Engineer | Connectivity, Enhanced Historian, PI integration |
| Admin | Users, Master Data, Admin Panel, Data Seeding |
| Analyst | Reports, Audit Logs |

### Current Maturity (Honest Summary)

| Area | Status |
|------|--------|
| Core production + RCA + tasks + reports + audit | **~90–95%** — backend-integrated, E2E tested |
| PI integration | **~90–95%** — proxy, pull, unmapped events, hierarchy mapping |
| Connectivity (OPC UA, Modbus, MQTT, etc.) | **~60%** — backend APIs exist; many protocol layers are simulated |
| Advanced RCA tools (Fishbone, FMEA, etc.) | **~95%** — all six tools in `RCAModule` Analyze tab; backend CRUD + E2E |
| CMMS integration | **~5%** — stub endpoints only |
| Settings / Permissions persistence | **~20%** — UI exists; not fully backend-persisted |
| Production deployment / hardening | **Not started** |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                              │
│  Port 8070 — Vite dev server                                            │
│                                                                          │
│  Pages → Services (MasterDataService, AuditService, PIStore, …)         │
│       → API clients (httpClient → /api/*)                               │
│       → Socket.IO (production events, connectivity)                     │
│                                                                          │
│  Contexts: AuthContext, PlantSelectionContext                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP + WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Monolith)                             │
│  Port 4004 — API prefix /api                                            │
│                                                                          │
│  63 feature modules │ JWT auth │ TypeORM │ MSSQL                         │
│  Global audit interceptor │ Socket.IO gateway │ @nestjs/schedule         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐   ┌────────────┐   ┌─────────────┐
         │ ProActDB │   │ PI Web API │   │ Industrial  │
         │ (MSSQL)  │   │ (proxied)  │   │ protocols   │
         └──────────┘   └────────────┘   └─────────────┘
```

### Design Principles in This Codebase

1. **Frontend facade:** Most pages call `MasterDataService` (not raw API clients directly).
2. **Plant selection drives scope:** Many pages use `plantSelection?.tenant?.id || session?.tenant?.id` for tenant scoping.
3. **Backend generates UUIDs** on insert for MSSQL tables (no DB default on `id` columns).
4. **Audit is dual:** Manual frontend logs + global backend interceptor on mutating API calls.
5. **Legacy IndexedDB** (`StorageService`) still exists for seeders and a few features — **not** the primary data path for main modules.

---

## 3. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts |
| State | React Context, TanStack Query (provider present), local component state |
| Backend | NestJS 11, TypeORM 0.3, class-validator, Swagger |
| Database | Microsoft SQL Server (`ProActDB`) |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |
| Real-time | Socket.IO (`RealtimeGateway`) |
| E2E tests | Playwright |
| Unit tests | Vitest (frontend), Jest (backend — minimal coverage) |

---

## 4. Getting Started (Local Development)

### Prerequisites

- **Node.js** 18+ and npm
- **SQL Server** (local or remote) with database `ProActDB`
- **Git**
- Optional: PI Web API server for live PI testing

### Step 1 — Clone & Install

```powershell
# From repository root
npm install

cd server/pro-act-backend
npm install
```

### Step 2 — Backend Environment

Copy and edit the backend `.env` (template at `server/pro-act-backend/env.template`):

```env
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword
DB_NAME=ProActDB

PORT=4004
NODE_ENV=development

JWT_SECRET=your-secret-min-32-chars
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=7d

CORS_ORIGIN=http://localhost:8070
CREDENTIAL_ENCRYPTION_KEY=your-encryption-key-32-chars
```

> **Important:** Frontend defaults to `http://localhost:4004/api`. Backend `.env` must set `PORT=4004` to match.

### Step 3 — Database Setup

Run the automated setup script (creates tables if missing):

```powershell
cd server/pro-act-backend/database-setup
.\setup-database.ps1
```

Or run SQL manually from:
- `server/pro-act-backend/database-setup/complete-automated-setup.sql`
- Additional migrations in `server/pro-act-backend/migrations/`

### Step 4 — Start Servers

**Option A — Two terminals:**

```powershell
# Terminal 1 — Backend
cd server/pro-act-backend
$env:PORT = '4004'
npm run start:dev

# Terminal 2 — Frontend
cd <repo-root>
npm run dev
```

**Option B — Root scripts:**

```powershell
.\start-all-servers.ps1
# or
.\START_SERVERS.ps1   # verify $projectRoot path in script first
```

### Step 5 — Verify

| URL | Expected |
|-----|----------|
| http://localhost:8070 | Login page |
| http://localhost:4004/api/health | `{ "status": "healthy", "database": "connected" }` |
| http://localhost:4004/api | Swagger API docs |

### Step 6 — Login / Test User

Default E2E test credentials (created by test setup if missing):

- **Email:** `test@example.com`
- **Password:** `Test123!@#`
- **Role:** SuperAdmin (after registration flow in E2E helpers)

### Step 7 — Select a Plant

After login, use the **plant selector** in the header (org → tenant/plant → unit). Many modules require a selected plant before data loads.

---

## 5. Project Structure

```
pro-act/
├── src/                          # Frontend React app
│   ├── pages/                    # Route-level screens
│   ├── components/               # UI components by domain
│   ├── contexts/                 # AuthContext, PlantSelectionContext
│   ├── services/                 # Domain services + api/ HTTP clients
│   ├── hooks/                    # useDashboardConfig, etc.
│   └── utils/
├── e2e/                          # Playwright E2E tests
├── server/pro-act-backend/       # NestJS backend
│   ├── src/                      # 63 feature modules
│   ├── database-setup/           # SQL scripts + setup PS1
│   ├── migrations/
│   └── test-all-endpoints*.ts    # API smoke tests
├── docs/                         # Documentation (this file + others)
├── playwright.config.ts
├── vite.config.ts                # Port 8070, PI proxy
└── package.json
```

### Frontend Routes (`src/App.tsx`)

| Route | Page | Nav visible |
|-------|------|-------------|
| `/dashboard` | Dashboard | Yes |
| `/production-plans` | Production Plans | Yes |
| `/events` | Event Hub | Yes |
| `/pla-analytics` | PLA Dashboard | Yes |
| `/rca` | RCA Module | Yes |
| `/rca-knowledge-base` | RCA Knowledge Base | Yes |
| `/tasks` | Task Management | Yes |
| `/reports` | Reports | Yes |
| `/audit` | Audit Logs | Yes |
| `/connectivity` | Connectivity | Yes |
| `/enhanced-historian` | Enhanced Historian | Yes |
| `/master-data` | Master Data | Yes |
| `/users` | User Management | Yes |
| `/admin` | Admin Panel | Yes |
| `/permissions` | Permissions | Yes |
| `/data-seeding` | Data Seeding | SuperAdmin only |
| `/settings` | Stub ("coming soon") | Yes |
| `/test-rca-tools` | Dev test page | No |

### Backend Module Categories (`server/pro-act-backend/src/`)

| Category | Modules |
|----------|---------|
| **Auth & users** | `auth`, `users`, `roles` |
| **Hierarchy** | `organization`, `tenant`, `unit`, `asset`, `hierarchy-mapping` |
| **Master data** | `product`, `impact-code`, `oee-code`, `reason-code`, `rca-cause-code`, `verification-status-code`, `evidence-category`, `evidence-location`, `custom-attribute-definition`, `custom-attribute-value` |
| **Production** | `production-plan-template`, `production-plan`, `production-event`, `production-loss`, `oee-summary`, `reconcile-form`, `loss-category`, `dashboard-configuration`, `app-settings` |
| **RCA** | `rca`, `rca-recommendation`, `rca-evidence`, `rca-template`, `rca-trigger-config`, `rca-knowledge-base`, `rca-analysis-config`, `logic-tree-node`, `five-why-analysis`, `fishbone-diagram`, `fmea-analysis`, `fault-tree-analysis`, `barrier-analysis`, `change-analysis`, `rca-analysis-methodology` |
| **Tasks & audit** | `task`, `audit-log`, `reporting` |
| **PI integration** | `pi-connection`, `pi-af-element`, `af-binding`, `pi-event`, `pi-mapping`, `pi-sync-watermark`, `pi-sync-job`, `pi-proxy`, `historian-tag`, `historian-history`, `unmapped-event`, `integration` |
| **Connectivity** | `connectivity`, `data-source`, `streaming` |
| **Infrastructure** | `health`, `realtime`, `common` |

---

## 6. Authentication & Multi-Tenancy

### Auth Flow

1. User logs in → `POST /api/auth/login` → JWT access + refresh tokens
2. Tokens stored in `localStorage` key `proact_auth_state`
3. `httpClient` attaches `Authorization: Bearer <token>` on every API call
4. `AuthContext` handles refresh before expiry

### Session Object

```typescript
{
  user: { id, email, name, role, tenantId, organizationId },
  organization: Organization | null,
  tenant: Tenant | null,
  tokens: { accessToken, refreshToken }
}
```

### Plant Selection (Separate from Auth Tenant)

`PlantSelectionContext` persists the user's UI hierarchy selection to:

- `GET/PUT /api/app-settings/plantSelection/value`

**Always resolve tenant like this in new code:**

```typescript
const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
```

### Roles

Roles include `SuperAdmin`, `Admin`, `Manager`, `Engineer`, `Operator` (see `roles` table / `RolesGuard`). Some endpoints (audit log delete) are SuperAdmin-only.

---

## 7. Module Reference (All Modules)

Status legend: ✅ Complete | 🟡 Partial | ❌ Stub / Not started

### 7.1 Core Platform

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Authentication** | `AuthContext`, `LoginForm` | `auth` module | ✅ | JWT; E2E covered |
| **Users** | `UserManagement.tsx` | `users` | ✅ | CRUD via `userApi` |
| **Roles** | Used in permissions UI | `roles` | 🟡 | Backend exists; permissions UI not persisted |
| **Organizations** | Master Data, Plant Selector | `organization` | ✅ | |
| **Tenants (Plants)** | Plant Selector | `tenant` | ✅ | |
| **Units & Assets** | Master Data, Plant Selector | `unit`, `asset` | ✅ | |
| **App Settings** | Branding, Plant Selection | `app-settings` | ✅ | Key/value store |
| **Health Check** | — | `health` | ✅ | `/api/health` |

### 7.2 Master Data

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Products** | Master Data, Plan forms | `product` | ✅ | |
| **Impact Codes** | Event Hub, Plan Dashboard | `impact-code` | ✅ | Auto-seeded on dashboard load |
| **OEE Codes** | Event Hub, Plan Dashboard | `oee-code` | ✅ | |
| **Reason Codes** | Master Data | `reason-code` | ✅ | |
| **RCA Cause Codes** | RCA Module | `rca-cause-code` | ✅ | |
| **Evidence Categories/Locations** | RCA evidence | `evidence-category`, `evidence-location` | ✅ | |
| **Custom Attributes** | Admin Panel | `custom-attribute-definition`, `custom-attribute-value` | 🟡 | API wired; limited UI |
| **RCA Templates** | RCA Module | `rca-template` | ✅ | |

### 7.3 Production Management

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Production Plan Templates** | `ProductionPlans.tsx` | `production-plan-template` | ✅ | E2E CRUD |
| **Production Plans** | `ProductionPlans.tsx` | `production-plan` | ✅ | |
| **Plan Dashboard** | `PlanDashboard.tsx` | Multiple APIs | ✅ | OEE calc, losses, reconcile; uses `plantSelection` tenant |
| **Production Events** | `EventHub.tsx` | `production-event` | ✅ | Real-time Socket.IO updates |
| **Production Losses** | Plan Dashboard | `production-loss` | ✅ | |
| **OEE Summaries** | Plan Dashboard | `oee-summary` | ✅ | Update DTO uses `overallOEE` field |
| **Loss Categories** | Plan Dashboard reconcile | `loss-category` | ✅ | |
| **Reconcile Forms** | Plan Dashboard | `reconcile-form` | ✅ | |
| **Dashboard Configuration** | `useDashboardConfig` hook | `dashboard-configuration` | ✅ | Stored as JSON in `widget_config` column |
| **PLA Analytics** | `PLADashboard.tsx` | `productionApi` + client calc | 🟡 | Analytics formulas client-side |

### 7.4 Event Hub & Loss Analysis

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Event Hub** | `EventHub.tsx` | `production-event` | ✅ | Tab visibility still in IndexedDB |
| **Status Automation Rules** | EventHub, AdminPanel | — | ❌ | `localStorage` only |
| **Unmapped Events** | EventHub, Plan Dashboard | `unmapped-event` | ✅ | Manual assignment to plans |
| **Event Pull** | Connectivity, EventPullService | `connectivity`, `integration` | 🟡 | PI pull works; other protocols stubbed |

### 7.5 RCA (Root Cause Analysis)

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **RCA Cases** | `RCAModule.tsx` | `rca` | ✅ | Core CRUD |
| **RCA Recommendations** | RCA Recommendations tab | `rca-recommendation` | 🟡 | Nested data not fully hydrated from API |
| **RCA Evidence** | RCA Module | `rca-evidence` | 🟡 | File upload backend exists |
| **Logic Tree** | RCA Module | `logic-tree-node` | 🟡 | Partial UI wiring |
| **RCA Auto-Create** | `RCATriggerSettings.tsx` | `rca-trigger-config` + hook in `production-event` | ✅ | E2E `rca-auto-create.spec.ts` |
| **Create Task from RCA** | `RCACreateTaskButton.tsx` | `task` + `rcaTaskBridge.ts` | ✅ | One-way bridge |
| **RCA Knowledge Base** | `RCAKnowledgeBase.tsx` | `rca-knowledge-base` | ✅ | |
| **Five Why Analysis** | Test page / partial RCA | `five-why-analysis` | 🟡 | Backend CRUD; limited production UI |
| **Fishbone Diagram** | Test page | `fishbone-diagram` | 🟡 | Backend CRUD |
| **FMEA Analysis** | Test page | `fmea-analysis` | 🟡 | Backend CRUD |
| **Fault Tree Analysis** | Test page | `fault-tree-analysis` | 🟡 | Backend CRUD |
| **Barrier Analysis** | Test page | `barrier-analysis` | 🟡 | Backend CRUD |
| **Change Analysis** | Test page | `change-analysis` | 🟡 | Backend CRUD |
| **RCA Analysis Config** | RCA settings | `rca-analysis-config` | 🟡 | |

### 7.6 Tasks & Workflow

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Tasks** | `Tasks.tsx` | `task` | ✅ | CRUD, filters, entity linking, overdue |
| **Task from RCA** | `RCACreateTaskButton` | `tasks` | ✅ | Uses `X-Client-Audited` to avoid duplicate audit |

### 7.7 Reporting & Audit

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Reports Dashboard** | `Reports.tsx` | `reporting` | ✅ | Overview + 5 tabs with charts |
| **OEE Report** | Reports tab | `GET /api/reports/oee-summary` | ✅ | |
| **Loss Report** | Reports tab | `GET /api/reports/production-loss` | ✅ | |
| **RCA Report** | Reports tab | `GET /api/reports/rca-summary` | ✅ | |
| **Audit Report** | Reports tab | `GET /api/reports/audit-trail` | ✅ | |
| **Tasks Report** | Reports tab | `GET /api/reports/task-summary` | ✅ | |
| **Audit Logs Page** | `AuditLogs.tsx` at `/audit` | `audit-log` | ✅ | Filtered list, dedicated page |
| **Auto Audit** | — | `AuditAutoLogInterceptor` | ✅ | All POST/PUT/PATCH/DELETE logged |
| **Manual Audit** | Auth, Tasks, Plans, EventHub | `POST /api/audit-logs` | ✅ | Frontend explicit logging |

### 7.8 PI Integration

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **PI Connections** | Connectivity → PI tab | `pi-connection` | ✅ | Encrypted credentials |
| **PI Proxy** | `PIClient.ts` via `/piwebapi` dev proxy | `pi-proxy` | ✅ | Bypasses browser CORS |
| **PI Browser** | Connectivity | `integration/PIBrowserController` | ✅ | Browse AF hierarchy |
| **PI Event Pull** | Auto sync services | `PIEventPullService` (cron) | ✅ | Scheduled pull |
| **PI Mappings** | PI Integration UI | `pi-mapping`, `af-binding` | ✅ | |
| **PI Sync Jobs** | PI sync manager | `pi-sync-job`, `pi-sync-watermark` | 🟡 | CRUD exists; scheduler execution basic |
| **Historian Tags/History** | Enhanced Historian | `historian-tag`, `historian-history` | 🟡 | Backend exists; UI partial |
| **Hierarchy Mapping** | `HierarchyMappingManager` | `hierarchy-mapping` | ✅ | Maps PI paths → units/assets |
| **Unmapped PI Events** | Event Hub, Connectivity | `unmapped-event` | ✅ | Code resolution service |
| **PI E2E** | — | — | ✅ | `e2e/pi-integration.spec.ts` |

### 7.9 Connectivity (Industrial Protocols)

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Connectivity Overview** | `Connectivity.tsx` | `connectivity` | 🟡 | Mixed real + simulated |
| **OPC UA** | Client connector + backend | `opcua-client.service.ts` | 🟡 | Real library; demo simulation in service layer |
| **Modbus** | Client connector | `modbus` services | 🟡 | Simulated at service layer |
| **MQTT** | Client connector | `mqtt` services | 🟡 | Simulated |
| **EtherNet/IP, BACnet, DNP3, Profinet, SCADA** | Client connectors | connectivity services | 🟡 | Mostly simulated |
| **REST API / Database connectors** | Client-side | `unified-event-pull` | ❌ | "Not yet implemented" in pull service |
| **Data Bindings** | BindingManager | `connectivity` data bindings | 🟡 | Partial |
| **Connectivity WebSocket** | `connectivityWebSocket.ts` | `ConnectivityGateway` | ✅ | |

### 7.10 Streaming & Data Sources

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Streaming Config** | UniversalConnectorService | `streaming` module | 🟡 | CRUD for sources/sinks/processors; no Kafka runtime |
| **Data Sources** | DataSourceManager | `data-source` | 🟡 | Registry exists |
| **Real-time Gateway** | productionEventsWebSocket | `realtime` | ✅ | Socket.IO broadcasts on entity changes |

### 7.11 Admin & Configuration

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **Admin Panel** | `AdminPanel.tsx` | Multiple | 🟡 | Branding, custom attrs, automation rules (local) |
| **Permissions** | `PermissionsManagement.tsx` | — | ❌ | UI only; `DEFAULT_ROLE_PERMISSIONS`; no API persist |
| **Settings** | `/settings` route | — | ❌ | "Coming soon" placeholder |
| **Data Seeding** | `DataSeedingPage.tsx` | Via APIs | 🟡 | Oil/gas/cement seeders; some still use IndexedDB |
| **Dashboard Config UI** | `DashboardConfiguration.tsx` | `dashboard-configuration` | 🟡 | Component exists; config loads via hook |

### 7.12 CMMS Integration

| Module | Frontend | Backend | Status | Notes |
|--------|----------|---------|--------|-------|
| **CMMS Push** | — | `integration` controller | ❌ | Returns "not implemented" stub |

---

## 8. Key User Workflows

### 8.1 Production Plan → Dashboard

```
Production Plans → Select plan → "Dashboard"
  → PlanDashboard loads (requires plantSelection tenant)
  → Fetches losses, OEE, events, codes, units
  → Calculates OEE client-side
  → Updates OEE summary via PUT /api/oee-summaries/:id
```

**Key files:** `PlanDashboard.tsx`, `useDashboardConfig.ts`, `productionApi.ts`

### 8.2 Event Hub → Production Event

```
Event Hub → Create/Edit event
  → Linked to unit + optional plan
  → masterDataService.createProductionEvent()
  → Audit logged (manual + interceptor)
  → Socket.IO broadcasts to other clients
```

### 8.3 PI Event Pull → Unmapped → Mapped

```
Configure PI connection → Hierarchy mappings
  → PIEventPullService (cron) or manual pull
  → Events matched to units via hierarchy-mapping
  → Unmatched → unmapped_events table
  → User assigns from Event Hub or Plan Dashboard
```

**Key files:** `pi-event-pull.service.ts`, `hierarchy-mapping.service.ts`, `master-data-code-resolver.service.ts`

### 8.4 RCA Auto-Create

```
Configure trigger rules (RCATriggerSettings)
  → Production event created/updated
  → rca-trigger-evaluator checks severity/type rules
  → rca-auto-create.service creates RCA case
```

**Key files:** `rca-trigger-evaluator.ts`, `rca-auto-create.service.ts`, `production-event.service.ts`

### 8.5 Create Task from RCA Recommendation

```
RCA Module → Recommendations tab → "Create Task"
  → rcaTaskBridge.buildTaskFromRecommendation()
  → POST /api/tasks (with X-Client-Audited header)
  → auditService.logCreate()
```

### 8.6 Audit Trail

```
Any API mutation → AuditAutoLogInterceptor (backend)
Frontend explicit actions → auditService → POST /api/audit-logs
View → /audit page or Reports → Audit tab
```

---

## 9. API & Integration Map

### Base URL

```
http://localhost:4004/api
```

Override frontend: `VITE_API_BASE_URL` in `.env` or `window.__PROACT_API_BASE_URL__`

### Frontend API Clients (`src/services/api/`)

| Client | Backend routes |
|--------|----------------|
| `authApi.ts` | `/auth/*` |
| `masterDataApi.ts` | `/organizations`, `/tenants`, `/units`, `/assets`, codes, templates |
| `productionApi.ts` | `/production-plans`, `/production-events`, `/production-losses`, `/oee-summaries`, `/rcas` |
| `taskApi.ts` | `/tasks` |
| `auditApi.ts` | `/audit-logs` |
| `reportingApi.ts` | `/reports/*` |
| `dashboardApi.ts` | `/dashboard-configurations` |
| `appSettingsApi.ts` | `/app-settings` |
| `connectivityApi.ts` | `/connectivity/*` |
| `piIntegrationApi.ts` | `/pi-connections`, `/pi-events`, `/pi-sync-jobs`, etc. |
| `piBrowserApi.ts` | `/pi-browser/:tenantId/*` |
| `hierarchyMappingApi.ts` | `/hierarchy-mappings` |
| `unmappedEventApi.ts` | `/unmapped-events` |
| `rcaTriggerConfigApi.ts` | `/rca-trigger-config` |
| `rcaAnalysisApi.ts` | `/rca-analysis/*`, `/five-why-analysis`, etc. |
| `knowledgeBaseApi.ts` | `/rca-knowledge-base` |
| `streamingApi.ts` | `/streaming/*` |

### Swagger

Full interactive API docs: **http://localhost:4004/api**

---

## 10. Real-Time & WebSockets

| Client file | Server | Events |
|-------------|--------|--------|
| `productionEventsWebSocket.ts` | `RealtimeGateway` | `productionEventCreated`, `Updated`, `Deleted` |
| `connectivityWebSocket.ts` | `ConnectivityGateway` | Connectivity status updates |

Socket URL: `http://localhost:4004` (namespace `/socket.io`)

---

## 11. Testing

### E2E (Playwright)

```powershell
# Starts frontend (8070) + backend (4004) automatically
npm run test:e2e

# With browser visible
npm run test:e2e:headed

# Interactive UI
npm run test:e2e:ui
```

| Spec file | What it tests |
|-----------|---------------|
| `auth.spec.ts` | Login, logout, invalid credentials |
| `master-data.spec.ts` | Org/tenant CRUD |
| `production-plans-crud.spec.ts` | Plan CRUD (API + UI) |
| `production.spec.ts` | Production UI flows |
| `event-pull-and-rca.spec.ts` | Event pull + RCA workflow |
| `rca-auto-create.spec.ts` | Auto-RCA on critical events |
| `pi-integration.spec.ts` | PI connections, pull, unmapped events |
| `tasks.spec.ts` | Task page + API CRUD |
| `reports.spec.ts` | Reports tabs + API 200s |
| `audit-auto-log.spec.ts` | Auto audit on task create |

**Test user:** `test@example.com` / `Test123!@#`

### Backend Endpoint Tests

```powershell
cd server/pro-act-backend
npm run test:all-endpoints
npm run test:comprehensive
```

### Frontend Unit Tests

```powershell
npm run test:run
```

---

## 12. Database

- **Engine:** Microsoft SQL Server
- **Database name:** `ProActDB`
- **ORM:** TypeORM with `synchronize: false` (schema via SQL scripts)
- **UUID pattern:** Backend services use `randomUUID()` from `crypto` on insert (MSSQL tables lack `DEFAULT NEWID()` on many tables)

### Important Tables

| Table | Purpose |
|-------|---------|
| `users`, `roles` | Authentication & authorization |
| `organizations`, `tenants`, `units`, `assets` | Hierarchy |
| `production_plans`, `production_events`, `production_losses` | Core production data |
| `oee_summaries` | OEE metrics per plan |
| `rcas`, `rca_recommendations`, `rca_evidence` | RCA data |
| `tasks` | Task management |
| `audit_logs` | Audit trail |
| `pi_connections`, `pi_events`, `pi_sync_jobs` | PI integration |
| `hierarchy_mappings`, `unmapped_events` | Event mapping |
| `dashboard_configurations` | Plan dashboard settings (JSON in `widget_config`) |
| `app_settings` | Key-value settings (plant selection, branding) |

### Setup Scripts

```
server/pro-act-backend/database-setup/
├── setup-database.ps1          # Main setup
├── complete-automated-setup.sql
├── fix-dashboard-configurations-id-default.sql
└── run-*-migration.ps1         # Individual migrations
```

---

## 13. Configuration & Environment Variables

### Backend (`server/pro-act-backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Yes | MSSQL connection |
| `PORT` | Yes | **Use 4004** for frontend compatibility |
| `JWT_SECRET` | Yes | Token signing |
| `JWT_REFRESH_SECRET` | Recommended | Refresh token signing |
| `CORS_ORIGIN` | Yes | `http://localhost:8070` for dev |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes for PI | Encrypts stored PI passwords |

### Frontend (optional `.env` in repo root)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Default: `http://localhost:4004/api` |
| `VITE_PI_SERVER` | PI Web API URL for Vite proxy (`/piwebapi`) |

### Vite Proxy (`vite.config.ts`)

- Dev server: **port 8070**
- Proxies `/piwebapi` → PI server (for direct browser PI calls when not using backend proxy)

---

## 14. Known Issues & Gotchas

1. **Backend must be running on port 4004** — Frontend hardcodes this default; `ERR_CONNECTION_REFUSED` means backend is down.

2. **Plant selection required** — Many pages need a plant selected in the header. `PlanDashboard` was fixed to use `plantSelection?.tenant?.id || session?.tenant?.id`.

3. **MSSQL UUID inserts** — Tables without `DEFAULT NEWID()` require backend `randomUUID()` in service `create()` methods.

4. **DTO field name mismatches** — Example fixed: OEE update uses `overallOEE` (not `oee`). Watch for similar frontend/backend mismatches.

5. **Dashboard config storage** — Frontend sends `oee`, `losses`, etc.; backend stores as JSON in `widget_config` column (mapper in `dashboard-configuration.mapper.ts`).

6. **Duplicate audit entries** — Frontend manual audit + backend interceptor can double-log. Use `X-Client-Audited: true` header when frontend already logs (see `taskApi.ts`).

7. **RCA nested data** — Evidence, recommendations, logic tree may not round-trip fully through `updateRCA` payload builder.

8. **Legacy IndexedDB** — `StorageService` still used by seeders and tab visibility; do not use for new features.

9. **Connectivity simulation** — Many protocol services simulate connect/read/write; real protocol clients exist at lower layer but aren't fully wired end-to-end.

10. **JWT not global** — `JwtAuthGuard` is per-controller, not `APP_GUARD`. Health endpoints are public.

---

## 15. What Remains for a Full Production Application

### Critical (Must Have for Production)

| Item | Current State | Work Needed |
|------|---------------|-------------|
| **Permissions persistence** | UI-only toggles | Backend roles/permissions API + enforce with guards |
| **Settings page** | Stub | System settings UI + backend |
| **RCA nested entities full sync** | Partial | Fix `mapRcaDto` / `buildUpdateRcaPayload` to include evidence, recommendations, logic tree |
| **Global auth guard** | Per-controller | Wire `JwtAuthGuard` as `APP_GUARD` with `@Public()` on open routes |
| **Production deployment** | Dev only | Docker, CI/CD, env management, secrets |
| **Error monitoring** | Console only | Sentry or similar |
| **Database migrations** | Manual SQL scripts | Formal migration runner (TypeORM migrations or Flyway) |
| **Security hardening** | Dev defaults | Strong JWT secrets, HTTPS, rate limiting, input sanitization audit |
| **Backup & recovery** | Not documented | MSSQL backup strategy |

### High Priority (Core Feature Gaps)

| Item | Current State | Work Needed |
|------|---------------|-------------|
| **CMMS integration** | Stub endpoint | Implement push to CMMS work orders |
| **Connectivity real protocols** | Simulated layers | Wire `*-client.service.ts` through to UI; complete `unified-event-pull` |
| **PI sync job execution** | CRUD only | Scheduler to run sync jobs from `pi_sync_jobs` table |
| **Advanced RCA tools in main UI** | Complete in `RCAModule` | Optional: `enabledTools` config round-trip polish |
| **Status automation rules** | localStorage | Persist to backend `app-settings` or dedicated table |
| **Event Hub tab visibility** | IndexedDB | Migrate to `app-settings` |
| **Historian UI** | Partial | Complete `EnhancedHistorian.tsx` with backend historian APIs |
| **Permissions enforcement** | Role in JWT only | Fine-grained permission checks per route/action |

### Medium Priority (Polish & Scale)

| Item | Work Needed |
|------|-------------|
| Duplicate RCA analysis modules | Consolidate standalone modules vs `rca-analysis-methodology` |
| Embedded `auditTrail` JSON on plans/events | Unify with central `audit_logs` table |
| `user_name` column on audit_logs | Optional DB migration (currently in `details` JSON) |
| Remove legacy IndexedDB from seeders | All seeders use `masterDataService` only |
| Kafka/Telegraf streaming runtime | Architecture docs exist; runtime not in this backend |
| Multi-language / i18n | Not started |
| Mobile-responsive audit | Some dashboards are desktop-focused |
| Unit test coverage | Minimal Jest/Vitest coverage |
| API versioning | Not implemented (`/api/v1`) |

### Low Priority (Future)

| Item | Notes |
|------|-------|
| Microservices split | `docs/microserviceSpecs.md` has strategy; current app is monolith |
| Advanced analytics ML | Not started |
| Offline PWA mode | IndexedDB legacy suggests this was a goal |
| Custom report builder | Fixed report tabs only |

---

## 16. Recommended Roadmap (Priority Order)

### Phase 1 — Stabilize (1–2 weeks)
1. Fix any remaining API field mismatches (grep for 400 validation errors)
2. Complete RCA nested entity round-trip
3. Migrate localStorage/IndexedDB settings to backend
4. Add global JWT guard + `@Public()` decorator usage
5. Expand E2E to connectivity and permissions flows

### Phase 2 — Complete Core (2–4 weeks)
1. Permissions API + enforcement
2. Settings page implementation
3. ~~Advanced RCA tools in main RCA module UI~~ (done — see `RCAModule` Analyze tab)
4. PI sync job scheduler execution
5. Real connectivity protocol wiring (at least OPC UA + MQTT end-to-end)

### Phase 3 — Production Ready (4–6 weeks)
1. Docker Compose (frontend + backend + MSSQL)
2. CI/CD pipeline with E2E on PR
3. CMMS integration (or remove stub)
4. Security audit + penetration testing
5. Performance testing on large event datasets
6. Documentation + runbooks for ops

### Phase 4 — Scale (ongoing)
1. Consider microservices per `docs/microserviceSpecs.md`
2. Kafka/streaming runtime if needed
3. Multi-region deployment
4. Advanced analytics

---

## 17. Quick File Reference

### Start Here When Debugging

| Problem | Check these files |
|---------|-------------------|
| API 401/403 | `src/contexts/AuthContext.tsx`, `src/services/api/httpClient.ts` |
| Wrong tenant / no data | `src/contexts/PlantSelectionContext.tsx`, plant selector header |
| Production plan dashboard stuck loading | `src/components/production-plans/PlanDashboard.tsx`, `src/hooks/useDashboardConfig.ts` |
| PI connection fails | `server/pro-act-backend/src/pi-proxy/`, `src/services/pi/PIClient.ts` |
| Events not pulling | `server/pro-act-backend/src/integration/pi-event-pull.service.ts` |
| RCA not auto-creating | `server/pro-act-backend/src/rca/rca-auto-create.service.ts`, `rca-trigger-config` |
| Audit missing | `server/pro-act-backend/src/audit-log/audit-auto-log.interceptor.ts` |
| Reports empty | `server/pro-act-backend/src/reporting/reporting.service.ts` |

### Key Backend Entry Points

| File | Purpose |
|------|---------|
| `server/pro-act-backend/src/main.ts` | Bootstrap, port, CORS, Swagger |
| `server/pro-act-backend/src/app.module.ts` | All module registrations |
| `server/pro-act-backend/src/auth/jwt-auth.guard.ts` | JWT validation |
| `server/pro-act-backend/src/realtime.gateway.ts` | Socket.IO |

### Key Frontend Entry Points

| File | Purpose |
|------|---------|
| `src/App.tsx` | Routes, providers |
| `src/components/Navigation.tsx` | Sidebar nav |
| `src/services/MasterDataService.ts` | Main data facade |
| `src/services/api/httpClient.ts` | HTTP + JWT |
| `vite.config.ts` | Port 8070, proxies |
| `playwright.config.ts` | E2E config |

### Other Documentation in `docs/`

| File | Topic |
|------|-------|
| `FRONTEND_FULL_DOCUMENTATION.md` | Deep frontend encyclopedia (some IndexedDB references outdated) |
| `CONNECTIVITY_MODULE.md` | Connectivity architecture |
| `FEATURE_IMPLEMENTATION_STATUS.md` | Older status doc (connectivity-focused; backend % outdated) |
| `PLA_RCA_TESTING_GUIDE.md` | Manual testing for PLA/RCA |
| `STEP_BY_STEP_TESTING_CHECKLIST.md` | QA checklist |
| `microserviceSpecs.md` | Future architecture |

---

## Appendix: Commands Cheat Sheet

```powershell
# ─── Development ───
cd server/pro-act-backend && $env:PORT='4004'; npm run start:dev   # Backend
npm run dev                                                           # Frontend (8070)

# ─── Build ───
cd server/pro-act-backend && npm run build
npm run build

# ─── Test ───
npm run test:e2e                    # Full E2E (both servers)
npm run test:run                    # Frontend unit tests
cd server/pro-act-backend && npm run test:all-endpoints

# ─── Database ───
cd server/pro-act-backend/database-setup && .\setup-database.ps1
cd server/pro-act-backend && npm run db:delete-all-data   # ⚠️ Wipes data

# ─── Health check ───
curl http://localhost:4004/api/health
```

---

**End of document.** For questions about a specific module, search this file for the module name, then follow the linked source files. When in doubt, check Swagger at `http://localhost:4004/api` and the E2E specs in `e2e/` for working examples.
