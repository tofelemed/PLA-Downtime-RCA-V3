# Unified-APM Frontend Deep-Dive

> **Audience**: New engineers, architects, SREs, and product stakeholders who need a single, exhaustive reference that explains how the Unified-APM (Pro-ACT) frontend works, how modules connect, and how to scale or extend the system with confidence.  
> **Scope**: Entire React/Vite codebase under `src/`, shared tooling, scripts, data services, contexts, UI primitives, and functional workflows. This document intentionally leans wide and deep—treat it as an encyclopedia for the app.

---

## 0. Executive Summary

- **What the system does**: Unified-APM is the browser-based control center for production intelligence. It enables manufacturing teams to log events, analyze losses, run Root Cause Analysis (RCA), manage master data, interact with historians (PI, OPC UA, etc.), and visualize production performance (OEE, losses, trends) across tenants/plants.
- **Core goals**:
  - Provide a multi-tenant, role-aware user experience for heavy-industry personas (operators, engineers, admins).
  - Offer deep analytics (dashboards, waterfall, Pareto, micro-trends) backed by offline-friendly storage to support field operation scenarios.
  - Serve as the orchestration layer for historian integrations, streaming telemetry, RCA tooling, and data seeding.
- **Architecture in one sentence**: A modular single-page React application (SPA) built with Vite and Tailwind, orchestrated through contexts and domain services, backed by an IndexedDB abstraction, and organized around business-aligned domains (Dashboard, Event Hub, RCA, Master Data, Connectivity, etc.).
- **When to read what**:
  - Starting development? Hit sections 2, 3, 4, and 6.
  - Debugging data flow? Go directly to sections 7, 8, 10, and 12.
  - Planning scalability or modularization? See sections 13, 15, and 16.
  - Need a refresher on UI or shared components? Browse sections 9 and 11.

---

## 1. System Purpose & Personas

| Persona | Needs | Key Modules |
| --- | --- | --- |
| Operator | Record production loss events, capture shift info, see alerts | `EventHub`, `Dashboard` overview cards |
| Production Engineer | Trend analysis, RCA investigations, plan execution | `Dashboard`, `ProductionPlans`, `RCAModule`, `PLADashboard` |
| Reliability Engineer | Manage historian connections, review PI data, configure auto-sync | `Connectivity`, `EnhancedHistorian`, `PIEventSyncManager` |
| Admin / Org Manager | Manage users, permissions, master data, automation rules | `UserManagement`, `PermissionsManagement`, `MasterData`, `AdminPanel` |
| Data Analyst | Export analytics, configure dashboards, inspect losses | `DashboardAnalytics`, `PLADashboard`, `LossTrendChart`, `PlanWaterfallChart` |
| Support / Field Engineer | Seed demo data, debug RCA or losses, run scripts | `DataSeedingPage`, console commands (`seedOilGasData`) |

---

## 2. Architectural Overview

### 2.1 Layers and Responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Presentation** | `src/pages`, `src/components`, `src/components/ui` | React components, layout, forms, visualization |
| **Application State** | `src/contexts`, `@tanstack/react-query` (provider), local component state | Authentication, plant selection, UI states, query caching |
| **Domain Services** | `src/services/**` | IndexedDB storage, API clients, analytics calculators, historian integration, data seeding utilities |
| **Persistence** | `StorageService` (IndexedDB), `localStorage`, backend APIs | Durable storage, token retention, remote data sync |
| **Infrastructure Scripts** | `src/scripts/**` | Run-time seeding, debugging tools (exposed on `window` in dev) |
| **Tooling** | Root configs (`vite.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `tsconfig*.json`) | Build, bundling, linting, type checking |

### 2.2 Runtime Targets

- **Primary**: Modern evergreen browsers (Chrome, Edge, Firefox) with IndexedDB support. Dark theme default enforces consistent look.
- **Offline-first**: All CRUD flows use `StorageService` (IndexedDB). Scripts toggle between offline and API-backed strategies. TanStack Query stands ready for REST integration.
- **Developer experience**: Vite dev server with HMR, SWC-based React plugin for performance, shadcn UI primitives for consistent styling, and console logging for guidance.

### 2.3 Integration Diagram

```
User → Browser (React SPA)
    ├─ AuthContext ↔ authApi → Backend auth service
    ├─ PlantSelectionContext ↔ StorageService.appSettings
    ├─ Page components ↔ Services (MasterData, Historian, PI, etc.)
    │       ├─ StorageService (IndexedDB)
    │       ├─ API layer (`services/api/*`)
    │       └─ Historian/PI connectors (PIClient, OPC UA, MQTT)
    ├─ Shared UI components (shadcn, charts, forms)
    └─ Scripts (seedOilGasData, debugRCAData) exposed via `window`
```

---

## 3. Boot Sequence (File-by-File)

1. **`src/main.tsx`**
   - Imports `App` and global CSS.
   - Logs console banners indicating seeding is disabled and how to trigger manual seeding (`seedOilGasData()`).
   - Ensures dark theme by adding `dark` to `document.body`.
   - Renders React root via `createRoot(...).render(<App />)`.

2. **`src/App.tsx`**
   - Instantiates `QueryClient` for TanStack Query.
   - Exposes key scripts to `window`:
     - `seedOilGasData`, `debugRCAData`, lazy loaded `debugProductionLosses`, and service singletons (`rcaTriggerConfigService`, `autoPIEventSyncService`...).
   - Wraps `AppRoutes` with provider stack:
     - `QueryClientProvider`
     - `TooltipProvider`
     - `Toaster` + `Sonner` (shadcn + alternative toast)
     - `AuthProvider`
     - `PlantSelectionProvider`
     - `BrowserRouter`
   - Defines `ProtectedRoute` to guard pages; shows `LoginForm` when unauthenticated, or `Layout` when session present.

3. **`AuthProvider` (`src/contexts/AuthContext.tsx`)**
   - On mount:
     - Initializes `StorageService`.
     - Restores session from `localStorage` (`AUTH_STORAGE_KEY`).
     - Refreshes tokens if expiring within 60 seconds (`refreshTokens` → `authApi.refreshToken`).
     - Fetches organization and tenant metadata via `masterDataApi` if IDs present (with fallbacks).
     - Sets `httpClient` token provider to integrate with API requests.
   - Exposes `login`, `logout`, `selectTenant` functions and `session`, `isLoading` state.

4. **`PlantSelectionProvider` (`src/contexts/PlantSelectionContext.tsx`)**
   - Initializes `StorageService`, loads previously selected plant/tenant from `appSettings` store.
   - Exposes `selection`, `setSelection`, `loading` to descendant components.

5. **Routing** (`AppRoutes` inside `App.tsx`)
   - Configures all application routes (dashboard, events, RCA, connectivity, etc.) wrapped in `ProtectedRoute` except the wildcard route.

---

## 4. Directory Inventory & Contracts

| Directory | Description | Notable Files |
| --- | --- | --- |
| `src/pages` | Top-level routed screens. Each exports a React component used in `AppRoutes`. | `Dashboard.tsx`, `EventHub.tsx`, `ProductionPlans.tsx`, `RCAModule.tsx`, `Connectivity.tsx`, `EnhancedHistorian.tsx`, `PLADashboard.tsx`, `MasterData.tsx`, `UserManagement.tsx`, `PermissionsManagement.tsx`, `AdminPanel.tsx`, `DataSeedingPage.tsx`, `TestRCAAnalysisTools.tsx`, `NotFound.tsx` |
| `src/components` | Domain and shared components grouped by capability. | `Layout.tsx`, `Navigation.tsx`, `PlantSelector.tsx`, `DashboardAnalytics.tsx`, `EventFormFields.tsx`, `RCASettings.tsx`, `HistorianMicroTrends.tsx`, `production-plans/*`, `historian/*`, `streaming/*`, `rca-settings/*`, etc. |
| `src/components/ui` | shadcn-derived UI primitives (buttons, cards, dialogs, tables, forms). | `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `form.tsx`, `toast.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx`, and ~50 other primitives. |
| `src/contexts` | Global React context providers. | `AuthContext.tsx`, `PlantSelectionContext.tsx` |
| `src/services` | Core business logic & integration layer (IndexedDB, analytics, APIs, historian, PI, streaming, alerts). | See section 8 for full breakdown |
| `src/scripts` | Developer scripts for seeding, debugging, cleanup. | `seedOilGasData.ts`, `seedCementIndustryData.ts`, `debugProductionLosses.ts`, `debugRCAData.ts`, etc. |
| `src/hooks` | Reusable hooks bridging state/services. | `useDashboardConfig.ts`, `useMasterData.ts`, `useToast.ts`, `use-mobile.tsx` |
| `src/utils` | Utility functions. | `analyticsHelpers.ts`, `durationFormatter.ts`, `debugHelper.ts` |
| `src/lib` | Helper libraries. | `utils.ts` (`cn` helper) |
| `src/types` | Shared TypeScript interfaces. | `CustomAttributes.ts`, `RCAKnowledgeBase.ts`, `RCATriggerConfig.ts` |
| `docs` | Documentation (this file, quick references). | `FRONTEND_FULL_DOCUMENTATION.md`, `QUICK_REFERENCE.md` |

---

## 5. Technology Stack & Libraries

- **Framework**: React 18 functional components with hooks, TypeScript for type safety.
- **Bundler**: Vite (fast dev server, build pipeline) with `@vitejs/plugin-react-swc` for SWC transpilation.
- **UI**: Tailwind CSS (utility classes), shadcn/ui (Radix UI powered primitives), Lucide icons, Embla Carousel, command palette (`cmdk`), `react-day-picker`.
- **State**: React context providers, component state, TanStack Query for data fetching/caching (available but not heavily used yet).
- **Forms**: `react-hook-form`, `zod` for schema validation, `@hookform/resolvers` for bridging.
- **Charts & Visualization**: `recharts`, `reactflow`, `react-chrono`, custom SVG visualizations.
- **Drag & Drop**: `@dnd-kit/*` for interactive reordering (plan templates, logic tree nodes).
- **Integrations**: PI Web API client, OPC UA (`node-opcua-client`), MQTT, SCADA connectors, streaming services.
- **Testing / Quality**: ESLint 9, TypeScript 5.5, `tailwindcss-animate`, autoprefixer, `vite` build scripts.

---

## 6. Routing & Navigation (Detailed)

Each path below is wrapped in `ProtectedRoute` unless noted. “Key children” refers to notable child components within the page.

| Route | Component | Description | Key Children / Sections | Data Sources |
| --- | --- | --- | --- | --- |
| `/` | Redirect | Redirect to `/dashboard`. | – | – |
| `/dashboard` | `Dashboard.tsx` | Primary operational cockpit with KPI cards, OEE breakdown, alerts, tasks, equipment summary, historian mini trends. | KPI card grid, `DashboardAnalytics`, `HistorianMicroTrends`, `Tabs` (`overview`, `analytics`, `alerts`, `tasks`, `equipment`). | `masterDataService` for plans/events/RCAs/losses; `UnifiedAnalyticsService` for OEE; `HistorianClient` + `PIClient`. |
| `/pla-analytics` | `PLADashboard.tsx` | Production loss analytics, waterfall and Pareto charts. | `PlanWaterfallChart`, `LossTrendChart`, `LossParetoChart`, `ProductionPlanSelector`. | `masterDataService`, analytics helpers. |
| `/production-plans` | `ProductionPlans.tsx` | Templates, plan creation, plan dashboard, approval workflow. | `TemplateWizard`, `TemplateManager`, `PlanForm`, `PlanList`, `PlanDashboard`. | `masterDataService` (plans, templates, units, products). |
| `/events` | `EventHub.tsx` | Multi-tab event capture with smart prompts, historian sparkline, RCA linking. | `Tabs`, `EventFormFields`, `ReasonCodeTreePicker`, `AuditTrailViewer`, `TimeSeriesChart`, `RCATriggerSettings`. | `masterDataService` (events, codes), `piStore`, `HistorianClient`. |
| `/rca` | `RCAModule.tsx` | End-to-end RCA workspace: logic trees, evidence, recommendations, team, timeline. | `LogicTreeBuilder`, `EvidenceCollector`, `RCATimeline`, `RecommendationList`, `TeamManagement`. | `masterDataService`, `RCAKnowledgeBaseService`, `RCATriggerConfigService`. |
| `/rca-knowledge-base` | `RCAKnowledgeBase.tsx` | Knowledge base for RCA articles/templates. | Filter/search panel, article cards, detail view. | `RCAKnowledgeBaseService`. |
| `/test-rca-tools` | `TestRCAAnalysisTools.tsx` | Sandbox for RCA components (5-Why, fishbone, barrier, change, FMEA). | Tool previews using shared components. | `storageService`. |
| `/connectivity` | `Connectivity.tsx` | Integration management (PI, OPC UA, MQTT, SCADA, streaming). | `PIEventSyncManager`, integration cards, job history. | `piStore`, `storageService` (`dataSources`). |
| `/enhanced-historian` | `EnhancedHistorian.tsx` | Historian exploration, tag management, overlay analysis. | `HistorianTagList`, `TimeSeriesChart`, `OverlayComparison`, query controls. | `HistorianClient`, `PIClient`. |
| `/users` | `UserManagement.tsx` | Manage users, roles, audit log entries. | User list, create/edit dialog, audit log viewer. | `storageService` (`users`, `auditLogs`). |
| `/permissions` | `PermissionsManagement.tsx` | Role capability matrix, inheritance controls. | Role-permission table, toggles, inheritance indicators. | `storageService` (permissions config). |
| `/admin` | `AdminPanel.tsx` | System configuration: automation rules, dashboard settings, integrations. | Automation editor, dashboard config, integration toggles, health/diagnostics. | `storageService`. |
| `/master-data` | `MasterData.tsx` | Manage hierarchy, products, codes, custom attributes. | `PlantHierarchyManager`, `ProductList`, `CodesManagement`, `CustomAttributeManagement`. | `MasterDataService`. |
| `/data-seeding` | `DataSeedingPage.tsx` | Trigger dataset seeding (ADNOC oil & gas, cement). | Seeding cards, progress tracker, instructions. | `seedOilGasData`, `seedCementIndustryData`. |
| `*` | `NotFound.tsx` | Friendly 404 page with navigation options. | – | – |

---

## 7. Global State & Context Providers

### 7.1 `AuthContext`

- **State shape** (`AuthSession`):
  - `user`: authenticated user (ID, name, email, role, org/tenant IDs).
  - `organization`: optional organization object (from `masterDataApi`).
  - `tenant`: optional tenant object (from `masterDataApi`).
  - `token`: access token.
- **Tokens** stored as `AuthTokens` (access, refresh, expiresAt). Persistence via `localStorage` (`AUTH_STORAGE_KEY`).
- **Public API**:
  - `session`: `AuthSession | null`.
  - `isLoading`: boolean (true while restoring session or refreshing tokens).
  - `login(email, password)`: uses `authApi.login`, maps tokens, builds session.
  - `logout()`: calls `authApi.logout`, clears state and storage.
  - `selectTenant(tenantId)`: fetches tenant via `masterDataApi.getTenant`, updates session + storage.
- **Token Refresh**: If `expiresAt` <= now + 60s, `refreshTokens` is invoked.
- **Error handling**: On failure, logs and clears state.

### 7.2 `PlantSelectionContext`

- On mount, initializes `storageService`, reads `plantSelection` from `appSettings`, sets to state.
- `setSelection(selection)` updates state and calls `storageService.setAppSetting('plantSelection', selection)`.
- Exposes `{ selection, setSelection, loading }`.

### 7.3 UI Provider Stack
- `TooltipProvider`: Radix tooltips.
- `Toaster` + `Sonner`: toast notifications.
- `BrowserRouter`: SPA routing.

---

## 8. Services & Data Layer (Deep Dive)

> **Note**: `StorageService` is central; most services wrap it or layer domain logic on top. Below are primary responsibilities and key functions per service category.

### 8.1 Core Storage (`src/services/StorageService.ts`)

- **Initialization** (`initialize`):
  - Opens IndexedDB `ProActDB` v19.
  - Creates object stores: users, organizations, tenants, units, assets, auditLogs, impactCodes, oeeCodes, rcaCauseCodes, verificationStatusCodes, products, productionPlans, productionPlanTemplates, productionEvents, rcAs, rcaRecommendations, rcaEvidence, logicTreeNodes, rcaTriggerConfigs, rcaKnowledgeBase, rcaAnalysisConfigs, fiveWhyAnalyses, fishboneDiagrams, fmeaAnalyses, barrierAnalyses, changeAnalyses, appSettings, rcaTemplates, evidenceCategories, evidenceLocations, productionLosses, oeeSummaries, reconcileForms, lossCategories, unmappedEvents, reasonCodes, dashboardConfigurations, piConnections, piAfElements, afBindings, piEvents, piMappings, piSyncWatermarks, piSyncJobs, historianTags, dataSources, customAttributeDefinitions, customAttributeValues, etc.
  - Sets indexes for tenantId, organizationId, createdAt, unitId, status, etc., enabling filtered queries.
- **CRUD API**:
  - `create<T>(storeName, data)`: adds entity with auto UUID, timestamps.
  - `get<T>(storeName, id)`, `update<T>(storeName, id, updates)`, `delete(storeName, id)`.
  - `query<T>(storeName, filters)` filters by tenantId, organizationId, unitId, status, planId, period, lossId.
- **App Settings**: `setAppSetting`, `getAppSetting`.
- **Audit Logs**: `logAudit` writes to `auditLogs`.
- **Real-time events**: `emitUpdate` dispatches `CustomEvent('dataUpdate')`; `onUpdate(callback)` adds listener.
- **Historian history**: `HistorianHistoryDB` handles query history with fallback storage.

### 8.2 Master Data (`src/services/MasterDataService.ts`)

- Defines TypeScript interfaces for organizational structure, production plans, events, RCA objects, loss analytics, evidence, recommendations, etc.
- Functions include:
  - `getOrganizations`, `getTenants`, `getUnits`, `getAssets`.
  - `getProducts`, `getImpactCodes`, `getOeeCodes`, `getReasonCodes`.
  - `getProductionPlans({ tenantId })`, `createProductionPlan`, `updateProductionPlan`, `deleteProductionPlan`.
  - `getProductionPlanTemplates({ tenantId })`, `createProductionPlanTemplate`, `deleteProductionPlanTemplate`.
  - `getProductionEvents({ tenantId })`, `createProductionEvent`, `updateProductionEvent`, `deleteProductionEvent`.
  - `getRCAs({ tenantId })`, `createRCA`, `updateRCA`, `addRCARecommendation`, `addRCAEvidence`, `saveLogicTree`.
  - `createAuditLog(details)` wrappers around `storageService.logAudit`.

### 8.3 API Layer (`src/services/api`)

- `httpClient.ts`: Configures underlying HTTP client (axios or fetch wrapper) with token provider set by `AuthContext`. Handles base URL, headers, and error logging.
- `authApi.ts`: Exposes `login`, `refreshToken`, `logout`. Maps backend response fields to `AuthSession`.
- `masterDataApi.ts`: Contains `getOrganization`, `getTenant`. Intended for backend integration; currently used during session restoration.

### 8.4 Analytics (`src/services/analytics`)

- `UnifiedAnalyticsService`:
  - `getDateRanges()`: returns dictionary of presets (today, yesterday, last7Days, last30Days, last90Days, thisMonth, lastMonth, thisYear) with start/end ranges and labels.
  - `filterEventsByDateRange(events, start, end)`: filters event arrays to specified range.
  - `calculateOEEMetrics(events, range)`: returns `{ availability, performance, quality, overallOEE }`.
  - `getTopImpactedAssets(events)`, `getCriticalEvents(events)` helper functions used by dashboards.
- `analyticsHelpers.ts`: Additional helpers for cost summaries, Pareto data, trend data.

### 8.5 Historian (`src/services/historian`)

- `HistorianClient`:
  - `register(provider)`, `unregister(id)`, `hasProvider(id)`.
  - `query(options)`: delegates to provider (PI, others) for time-series data.
  - Potential subscription hooks for realtime updates.
- `providers/pi/PIHistorianProvider`:
  - Implements PI-specific fetch methods (recorded, interpolated, summary, plot).
  - Uses `PIClient` to call PI Web API endpoints.

### 8.6 PI Services (`src/services/pi`)

- `PIClient`:
  - Configurable basePath (default `/piwebapi`).
  - Accepts `authProvider` returning Basic Auth header.
  - Methods: `getPoints`, `getRecordedData`, `getInterpolatedData`, `getSummaryData`, etc.
- `PIStore`:
  - Saves PI connection config per tenant (url, username, password). `getConnectionByTenant(tenantId)`.
  - Supports storing AF elements, mappings, sync watermarks, jobs.
- `AutoPIEventSyncService`:
  - Schedules periodic event synchronization from PI to production events using AF templates and mapping definitions.
  - Exposed globally for debugging/testing.

### 8.7 Streaming, Connectivity, Alerts

- `services/streaming/*`: Manage MQTT, OPC UA, Ethernet/IP, BACnet, DNP3 connectors. Provide start/stop, status storage, job history logging.
- `services/integrations/*`: Additional integration handlers (SCADA, Profinet).
- `services/alerts/AlertService.ts`: Compose and dispatch user alerts (toast, badges) for events, plan status, RCA updates.
- `services/quality/QualityService.ts`: Evaluate quality metrics, store results for dashboards.

### 8.8 Tab Visibility (`src/services/TabVisibilityService.ts`)

- Methods:
  - `getVisibility(routeKey)`: returns saved config (e.g., which tabs visible).
  - `setVisibility(routeKey, config)`: persists to `localStorage` or `StorageService`.
- Used by Event Hub, dashboards to remember user preferences.

### 8.9 RCA Services

- `RCAKnowledgeBaseService.ts`: CRUD for knowledge base articles, categories, verification statuses. Supports search and tag filtering.
- `RCAAnalysisConfigService.ts`: Stores standard analysis templates, verification statuses.
- `RCATemplatesAndChecklistsSeeder.ts`: Helper to seed templates/checklists into IndexedDB.
- `RCATriggerConfigService.ts`: Manages automation rules linking events to RCA creation, status changes.

---

## 9. Shared UI & Styling

### 9.1 shadcn UI Primitives (`src/components/ui`)

| Component | Purpose | Notes |
| --- | --- | --- |
| `button.tsx` | CTA buttons | Uses CVA for variants (`default`, `outline`, etc.). |
| `card.tsx` | Card containers | Used heavily for KPIs and info panels. |
| `tabs.tsx` | Tabbed interfaces | Powered by Radix UI under the hood. |
| `dialog.tsx` | Modal windows | Event creation, template editing. |
| `alert-dialog.tsx` | Confirmation modals | Delete confirmations. |
| `form.tsx` | Form wrapper | Integrates with `react-hook-form`. |
| `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx` | Form controls | Compose forms across modules. |
| `table.tsx` | Data tables | Plan lists, user tables, asset lists. |
| `toast.tsx`, `sonner.tsx` | Toast notifications | Display success/failure messages. |
| `command.tsx` | Command palette | Optional quick navigation. |
| `popover.tsx`, `tooltip.tsx` | Hover/tap overlays | Tooltips in analytics, forms. |
| `scroll-area.tsx` | Styled scroll area | Long lists, log views. |
| `badge.tsx`, `chip.tsx` | Status indicators | Severity, role badges. |

### 9.2 Styling

- `tailwind.config.ts`: Extends theme, defines color palette, fonts, utilities. Includes `tailwindcss-animate` for animations and `@tailwindcss/typography` for content styling.
- `index.css`, `App.css`: Base resets, global typography, scrollbars, dark mode settings.
- Dark mode enforced globally (`document.body.classList.add('dark')` in `main.tsx`).
- Use `useMobile` hook for responsive adjustments (e.g., showing bottom navigation on mobile).

---

## 10. Hooks & Utilities

### 10.1 Hooks

| Hook | File | Description |
| --- | --- | --- |
| `useDashboardConfig` | `src/hooks/useDashboardConfig.ts` | Manages persisted dashboard settings (date ranges, card visibility). |
| `useMasterData` | `src/hooks/useMasterData.ts` | Fetches and caches master data (units, assets, products) with memoization. |
| `useToast` | `src/hooks/use-toast.ts` | Wrapper hook to show toasts using shadcn’s toaster. |
| `useMobile` | `src/hooks/use-mobile.tsx` | Returns boolean for mobile viewport; used in layout and nav. |
| (Component-specific hooks) | – | Many components define local hooks for filters, forms, watchers. |

### 10.2 Utilities

- `lib/utils.ts`: `cn` helper, helper functions for merging class names, formatting.
- `utils/durationFormatter.ts`: Converts durations (minutes) to hours/minutes strings.
- `utils/analyticsHelpers.ts`: Shared analytics operations (loss breakdown, Pareto data).
- `utils/debugHelper.ts`: Logging utilities to enable/disable verbose debug logs.
- `utils/date` (if present): Standard date/time formatting helpers.

### 10.3 Types

- `types/CustomAttributes.ts`: Defines structures for custom attribute definitions and values.
- `types/RCAKnowledgeBase.ts`: Interfaces for knowledge base entries (title, content, verification status, tags).
- `types/RCATriggerConfig.ts`: Structures representing trigger conditions, thresholds, statuses.
- Additional inline types exist within services for domain-specific models.

---

## 11. Domain Modules & Components

### 11.1 Layout & Navigation

- `Layout.tsx`: Shell containing sidebar, header, plant selector, command menu, toast container. Handles responsive behavior (drawer on small screens).
- `Navigation.tsx`: Builds navigation menu with icons, route links, badge counts (e.g., open RCAs). Applies role-based filtering.
- `PlantSelector.tsx`: Provides cascading selectors for organization → tenant → unit → asset. Uses `PlantSelectionContext` & `MasterDataService`.

### 11.2 Dashboard Components

- `Dashboard.tsx`: See Section 6 for details; orchestrates KPI cards, tabs, historian micro trends.
- `DashboardAnalytics.tsx`: Renders charts with `recharts` (OEE trends, loss breakdown). Accepts data props from `Dashboard`.
- `HistorianMicroTrends.tsx`: Displays quick PI trend charts; uses `HistorianClient`.
- `PlanWaterfallChart.tsx`, `LossTrendChart.tsx`, `LossParetoChart.tsx`: Chart components used by `Dashboard` and `PLADashboard`.

### 11.3 Production Plans

- `TemplateWizard.tsx`: Multi-step plan template wizard (basic info, product selection, useful time configuration, recurrence, review).
- `TemplateManager.tsx`: Manage existing templates, duplication, version control.
- `PlanForm.tsx`: Form to create/edit plans based on templates; uses `react-hook-form`.
- `PlanList.tsx`: Table of plans with actions (edit, duplicate, delete).
- `PlanDashboard.tsx`: Visual analytics for individual plan (actual vs planned production, OEE).

### 11.4 Event Hub

- Tabbed UI: `ProductionLoss`, `IOW`, `SOL`, `APM`, `FailureWO`, `ProductionOutput`.
- `EventFormFields.tsx`: Renders dynamic forms based on event type; includes inputs for duration, severity, costs, recommended actions, etc.
- `ReasonCodeTreePicker.tsx`: Tree/UI to select ISA-95 reason codes.
- `AuditTrailViewer.tsx`: Shows audit logs for selected event.
- `TimeSeriesChart.tsx`: Historian sparkline embedded in event detail view.
- Smart prompts for operator, shift, crew (auto-suggestions).
- Status automation rules defined in `defaultStatusAutomationRules` array; can be customized via localStorage or Admin Panel.

### 11.5 RCA Module

- `RCAModule.tsx`: High-level container; coordinates logic tree, evidence, recommendations, timeline, team sections.
- `components/rca-analysis/*`: Tools for logic tree, fishbone, five-why, barrier analysis.
- `LogicTreeBuilder.tsx`: Drag-and-drop interface (React Flow) for root cause trees.
- `EvidenceCollector.tsx`: Manage attachments, time-series evidence, severity, tags.
- `RCATimeline.tsx`: Visual timeline of RCA phases.
- `RCASettings.tsx`: Configure RCA metadata (priority, status).
- `RCATriggerSettings.tsx`: Manage automation rules linking events and RCAs.

### 11.6 Knowledge Base

- `RCAKnowledgeBase.tsx`: Lists articles/templates; filter by verification status, category, severity.
- Articles stored via `RCAKnowledgeBaseService`; accessible for linking to RCAs or events.

### 11.7 Connectivity & Historian

- `Connectivity.tsx`: Overview cards for PI, OPC UA, MQTT, BACnet, Modbus, DNP3, Profinet, SCADA connectors. Each card provides forms to configure endpoints, test connections, view sync jobs.
- `PIEventSyncManager.tsx`: Manage PI sync jobs (create, run, monitor).
- `EnhancedHistorian.tsx`: Explorer for historian data; features tag search, favorites, overlay charts.
- `HistorianTagList.tsx`: Browser for historian tags with search, filter.

### 11.8 Master Data

- `PlantHierarchyManager.tsx`: Manage organization → tenant → unit → asset hierarchy.
- `CodesManagement.tsx`: Manage impact, OEE, reason codes.
- `CustomAttributeForm.tsx` / `CustomAttributeDisplay.tsx`: Manage custom attributes for entities.
- `ProductList.tsx`: Manage products and associated metadata.

### 11.9 Admin & Permissions

- `AdminPanel.tsx`: System configuration including dashboard defaults, status automation, integration toggles, diagnostics, audit log viewer.
- `PermissionsManagement.tsx`: Manage role-permission matrix; supports inheritance overrides and toggles.
- `UserManagement.tsx`: Role-based user management; includes create/edit dialog, inline actions, audit logging.

### 11.10 Data Seeding & Scripts

- `DataSeedingPage.tsx`: Provides UI to trigger data seeding scripts; shows progress, instructions.
- Scripts under `src/scripts`: seed data, debug scenarios, cleanup tasks (all rely on `StorageService`).

---

## 12. Data Flow Scenarios

### 12.1 Authentication Flow
1. `AuthProvider` initializes `StorageService`.
2. Reads tokens from `localStorage`; refreshes via `authApi.refreshToken` if close to expiry.
3. Fetches organization/tenant details if IDs available.
4. Sets `session`; `ProtectedRoute` renders `Layout`.
5. `LoginForm` uses `AuthContext.login` to authenticate and persist tokens.

### 12.2 Dashboard Load
1. Determine `tenantId` from `PlantSelectionContext` or `session`.
2. Fetch production plans, events, RCAs, losses, units, assets via `masterDataService`.
3. Filter events by date range using `UnifiedAnalyticsService`.
4. Compute OEE metrics and quick stats; render KPI cards and charts.
5. Initialize historian client via `piStore` and `PIClient`.

### 12.3 Event Creation
1. User fills form generated by `EventFormFields`.
2. Smart prompts fill operator, shift, crew suggestions.
3. On submit, apply status automation rules (`defaultStatusAutomationRules` or stored overrides).
4. Persist event via `masterDataService`; log audit.
5. UI updates event lists and counts.

### 12.4 RCA Lifecycle
1. Event triggers RCA or user manually creates one.
2. Main module loads RCA data (logic tree, evidence, recommendations, timeline).
3. Users edit logic tree, attach evidence, add recommendations.
4. Status transitions tracked; timeline updated.
5. Completion records ROI, cost savings, downtime reduction metrics.

### 12.5 Historian Query
1. User selects tags in `EnhancedHistorian`.
2. `HistorianClient.query` fetches data via `PIHistorianProvider`.
3. Data rendered in `TimeSeriesChart`.
4. Query history stored in `HistorianHistoryDB`; favorites saved to `StorageService`.

---

## 13. Scalability & Modularity Strategy

### 13.1 Current State
- Monolithic SPA with modular directory structure.
- IndexedDB for persistence; offline-friendly.
- Shared services and contexts allow cross-module interaction.

### 13.2 Path to Microfrontends
- Break down by domain (Dashboard, Event Hub, RCA, Connectivity, Admin).
- Extract shared packages (`@unified-apm/ui`, `@unified-apm/services`).
- Use Module Federation (Webpack/Vite plugin) to compose independent builds.
- Provide shared contexts (Auth, Plant selection) via host shell APIs.
- Align backend services with domain boundaries.

### 13.3 Deployment & Scaling Today
- Build via `npm run build`; serve `dist/` via CDN or backend.
- Ensure backend APIs scale for auth, data fetch.
- Consider code splitting/lazy loading for heavy routes (RCA tools, historian).

---

## 14. Security Considerations

- Store tokens securely (currently in `localStorage`). Consider httpOnly cookies for production.
- Role-based navigation ensures basic access control, but server must enforce authorization.
- PI credentials stored in IndexedDB; future task: encrypt at rest or secure storage.
- Remove dev-only scripts (`seedOilGasData`, etc.) from production builds or restrict to privileged roles.
- Use HTTPS everywhere to protect credentials and tokens.

---

## 15. Performance & Observability

- Console logs prefixed for clarity (`[Dashboard]`, `[StorageService]`). Use `debugHelper` for verbose logging.
- Toasts indicate success/failure for user actions.
- Potential enhancements:
  - Add error boundaries for better crash UX.
  - Integrate telemetry (Sentry/AppInsights).
  - Lazy load large modules; prefetch frequently used data with React Query.
  - Add service worker for offline asset caching.

---

## 16. Developer Workflow

1. Install dependencies: `npm install`.
2. Start dev server: `npm run dev` (http://localhost:5173).
3. Seed demo data via `Data Seeding` page or console (`seedOilGasData()`).
4. Use `npm run lint` before committing.
5. Build for production: `npm run build`; preview with `npm run preview`.
6. For debugging data, use scripts like `debugRCAData()`, `debugProductionLosses()`.
7. Keep this document and `QUICK_REFERENCE.md` updated alongside code changes.

---

## 17. Appendices

### 17.1 Glossary
- **OEE**: Overall Equipment Effectiveness (Availability × Performance × Quality).
- **RCA**: Root Cause Analysis (logic tree, evidence, recommendations).
- **Historian**: Time-series data store (e.g., PI).
- **Tenant**: Plant or facility under an organization.
- **Impact Code**: Categorizes production losses.
- **OEE Code**: Categorizes OEE-related events.
- **Reason Code**: ISA-95 standard reason codes used in event classification.

### 17.2 Console Commands
- `seedOilGasData()` – Seed ADNOC dataset.
- `debugRCAData()` – Inspect RCA configuration/data quality.
- `debugProductionLosses()` – Debug production loss data (lazy-loaded).
- `autoPIEventSyncService.*` – Control PI auto-sync jobs.

### 17.3 Onboarding Checklist
1. Run `npm install`, `npm run dev`.
2. Read sections 0–6 of this doc.
3. Seed data via `Data Seeding` page.
4. Explore key modules (Dashboard, Event Hub, RCA, Connectivity).
5. Review `StorageService` and `MasterDataService` for data models.
6. Learn UI primitives in `components/ui`.
7. Before pushing, run `npm run lint`.

---

## 18. Future Enhancements

- **Microfrontends**: Adopt Module Federation for domain-based separation.
- **Service Extraction**: Publish shared services and UI as packages.
- **State Machines**: Use XState for complex workflows (e.g., RCA status transitions).
- **Automated Testing**: Add component/unit tests (React Testing Library/Jest).
- **Security**: Encrypt sensitive data in IndexedDB, tighten auth storage.
- **Telemetry**: Integrate with Sentry/AppInsights for error tracking.
- **Performance**: Lazy load heavy features, add service worker caching.

---

## 19. Closing Notes

This document is the authoritative frontend reference. Update it whenever architecture shifts, modules change, or new features land. Pair it with in-code comments, inline JSDoc, and quick references to keep the knowledge base fresh. With this map, any engineer or stakeholder should be able to understand, operate, and extend the Unified-APM frontend confidently.

