import { lazy, type ComponentType } from 'react';
import { lazyNamed } from '@/lib/lazy-named';

/**
 * Route-level code splitting (plan 3.1 step 6): every page is its own chunk, loaded on first visit, so
 * the initial bundle holds only the shell (auth, layout, providers).
 */
export const Dashboard = lazy(() => import('@/pages/Dashboard'));
export const UserManagement = lazyNamed(() => import('@/pages/UserManagement'), 'UserManagement');
export const AdminPanel = lazyNamed(() => import('@/pages/AdminPanel'), 'AdminPanel');
export const PermissionsManagement = lazyNamed(() => import('@/pages/PermissionsManagement'), 'PermissionsManagement');
export const MasterData = lazy(() => import('@/pages/MasterData'));
export const EventHub = lazyNamed(() => import('@/pages/EventHub'), 'EventHub');
/** Event Hub on v2 (plan 3.2), served at `/events` while the `v2.eventHub` flag is on. */
export const EventHubV2 = lazyNamed(() => import('@/features/event-hub/event-hub-page'), 'EventHubPage');
/** Downtime Analysis (plan 3.3), served at `/downtime` while the `v2.downtimeAnalysis` flag is on. */
export const DowntimeAnalysis = lazyNamed(() => import('@/features/downtime-analysis/downtime-page'), 'DowntimeAnalysisPage');
/** What `/downtime` shows while the flag is off: the screen has no v1 binding. */
export const DowntimeAnalysisOff = lazyNamed(() => import('@/features/downtime-analysis/downtime-off'), 'DowntimeAnalysisOff');
/** Plans, profiles & calendars (plan 3.4), served at `/planning` while `v2.plansProfilesCalendars` is on. */
export const Planning = lazyNamed(() => import('@/features/plans-profiles-calendars/planning-page'), 'PlanningPage');
/** What `/planning` shows while the flag is off (the v1 plans, units and products screens stay). */
export const PlanningOff = lazyNamed(() => import('@/features/plans-profiles-calendars/planning-off'), 'PlanningOff');
/** Plan Dashboard period accounting (plan 3.5), served at `/plans/:planId` while `v2.planDashboard` is on. */
export const PlanDashboardV2 = lazyNamed(() => import('@/features/plan-dashboard/plan-dashboard-page'), 'PlanDashboardPage');
/** What `/plans/:planId` shows while the flag is off (the v1 Plan Dashboard opens from Production Plans). */
export const PlanDashboardOff = lazyNamed(() => import('@/features/plan-dashboard/plan-dashboard-off'), 'PlanDashboardOff');
export const RCAModule =lazyNamed(() => import('@/pages/RCAModule'), 'RCAModule');
export const RcaV2 = lazyNamed(() => import('@/features/rca/rca-page'), 'RcaPage');
export const RCAKnowledgeBase = lazyNamed(() => import('@/pages/RCAKnowledgeBase'), 'RCAKnowledgeBase');
export const RcaKnowledgeV2 = lazyNamed(() => import('@/features/rca-knowledge/rca-knowledge-page'), 'RcaKnowledgePage');
export const TestRCAAnalysisTools = lazy(() => import('@/pages/TestRCAAnalysisTools'));
export const Connectivity = lazyNamed(() => import('@/pages/Connectivity'), 'Connectivity');
/** Integration console (plan 3.7), served at `/connectivity` while the `v2.integrationConsole` flag is on. */
export const IntegrationConsole = lazyNamed(() => import('@/features/integration-console/integration-console-page'), 'IntegrationConsolePage');
/** Codes and declarative admin rules (plan 3.8), served at `/codes-admin` while `v2.codesAdmin` is on. */
export const CodesAdmin = lazyNamed(() => import('@/features/codes-admin/codes-admin-page'), 'CodesAdminPage');
/** What `/codes-admin` shows while the flag is off (the v1 code screens in Master Data stay). */
export const CodesAdminOff = lazyNamed(() => import('@/features/codes-admin/codes-admin-off'), 'CodesAdminOff');
/** Valuation policy and FX rates (plan 2.6 screens), served at `/finance` while `v2.codesAdmin` is on. */
export const Finance = lazyNamed(() => import('@/features/finance/finance-page'), 'FinancePage');
/** What `/finance` shows while the flag is off (there is no v1 finance screen). */
export const FinanceOff = lazyNamed(() => import('@/features/finance/finance-off'), 'FinanceOff');
export const EnhancedHistorian = lazyNamed(() => import('@/pages/EnhancedHistorian'), 'EnhancedHistorian');
export const PLADashboard = lazy(() => import('@/pages/PLADashboard'));
export const Reports = lazy(() => import('@/pages/Reports'));
/** PLA Analytics, Reports and the Dashboard on v2 (plan 3.6), served while `v2.plaAnalytics` is on. */
export const PlaAnalyticsV2 = lazyNamed(() => import('@/features/pla-analytics/pla-analytics-page'), 'PlaAnalyticsPage');
export const ReportsV2 = lazyNamed(() => import('@/features/pla-analytics/reports/reports-page'), 'ReportsV2Page');
export const DashboardV2 = lazyNamed(() => import('@/features/pla-analytics/dashboard/analytics-dashboard'), 'AnalyticsDashboard');
export const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
export const Tasks = lazy(() => import('@/pages/Tasks'));
export const ProductionPlans = lazy(() => import('@/pages/ProductionPlans'));
export const NotFound = lazy(() => import('@/pages/NotFound'));

/**
 * Development-only pages — legacy demo seeding (A4: old seeders retire with 3.1) and the UX kit
 * playground. `import.meta.env.DEV` is a build-time constant, so production builds drop these imports
 * entirely (enforced by scripts/vite-prod-bundle-guard.ts).
 */
export const DEV_PAGES: ReadonlyArray<[path: string, page: ComponentType]> = import.meta.env.DEV
  ? [
      ['/data-seeding', lazy(() => import('@/pages/DataSeedingPage'))],
      ['/dev/ux-kit', lazyNamed(() => import('@/features/ux-kit/ux-kit-playground'), 'UxKitPlayground')],
    ]
  : [];
