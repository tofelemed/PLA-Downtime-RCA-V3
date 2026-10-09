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
export const RCAModule =lazyNamed(() => import('@/pages/RCAModule'), 'RCAModule');
export const RCAKnowledgeBase = lazyNamed(() => import('@/pages/RCAKnowledgeBase'), 'RCAKnowledgeBase');
export const TestRCAAnalysisTools = lazy(() => import('@/pages/TestRCAAnalysisTools'));
export const Connectivity = lazyNamed(() => import('@/pages/Connectivity'), 'Connectivity');
export const EnhancedHistorian = lazyNamed(() => import('@/pages/EnhancedHistorian'), 'EnhancedHistorian');
export const PLADashboard = lazy(() => import('@/pages/PLADashboard'));
export const Reports = lazy(() => import('@/pages/Reports'));
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
