import { lazyNamedWithPreload, lazyWithPreload } from '@/lib/lazy-with-preload';
import { FlaggedRoute } from '@/features/v2-foundation/flagged-route';
import type { AppRoute } from './route-types';

const EventHubV1 = lazyNamedWithPreload(() => import('@/pages/EventHub'), 'EventHub');
/** Event Hub on v2 (plan 3.2), served at `/events` while the `v2.eventHub` flag is on. */
const EventHubV2 = lazyNamedWithPreload(() => import('@/features/event-hub/event-hub-page'), 'EventHubPage');
/** Downtime Analysis (plan 3.3), served at `/downtime` while the `v2.downtimeAnalysis` flag is on. */
const DowntimeAnalysis = lazyNamedWithPreload(() => import('@/features/downtime-analysis/downtime-page'), 'DowntimeAnalysisPage');
const DowntimeAnalysisOff = lazyNamedWithPreload(() => import('@/features/downtime-analysis/downtime-off'), 'DowntimeAnalysisOff');
const PlaDashboardV1 = lazyWithPreload(() => import('@/pages/PLADashboard'));
const PlaAnalyticsV2 = lazyNamedWithPreload(() => import('@/features/pla-analytics/pla-analytics-page'), 'PlaAnalyticsPage');
const ProductionPlans = lazyWithPreload(() => import('@/pages/ProductionPlans'));
/** Plans, profiles & calendars (plan 3.4), served at `/planning` while `v2.plansProfilesCalendars` is on. */
const Planning = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/planning-page'), 'PlanningPage');
const PlanningOff = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/planning-off'), 'PlanningOff');
/** Plan Dashboard period accounting (plan 3.5), served at `/plans/:planId` while `v2.planDashboard` is on. */
const PlanDashboardV2 = lazyNamedWithPreload(() => import('@/features/plan-dashboard/plan-dashboard-page'), 'PlanDashboardPage');
const PlanDashboardOff = lazyNamedWithPreload(() => import('@/features/plan-dashboard/plan-dashboard-off'), 'PlanDashboardOff');

const planDashboard = (
  <FlaggedRoute flag="v2.planDashboard" v1={<PlanDashboardOff />} v2={<PlanDashboardV2 />} preloadV2={PlanDashboardV2.preload} />
);

/** Production area: events, downtime, loss analysis, plans and planning (tracks T1, T2, T6). */
export const PRODUCTION_ROUTES: readonly AppRoute[] = [
  {
    path: '/events',
    element: <FlaggedRoute flag="v2.eventHub" v1={<EventHubV1 />} v2={<EventHubV2 />} preloadV2={EventHubV2.preload} />,
    preload: EventHubV2.preload,
  },
  {
    path: '/downtime',
    element: (
      <FlaggedRoute flag="v2.downtimeAnalysis" v1={<DowntimeAnalysisOff />} v2={<DowntimeAnalysis />} preloadV2={DowntimeAnalysis.preload} />
    ),
    preload: DowntimeAnalysis.preload,
  },
  {
    path: '/pla-analytics',
    element: <FlaggedRoute flag="v2.plaAnalytics" v1={<PlaDashboardV1 />} v2={<PlaAnalyticsV2 />} preloadV2={PlaAnalyticsV2.preload} />,
    preload: PlaAnalyticsV2.preload,
  },
  { path: '/production-plans', element: <ProductionPlans />, preload: ProductionPlans.preload },
  {
    path: '/planning',
    element: <FlaggedRoute flag="v2.plansProfilesCalendars" v1={<PlanningOff />} v2={<Planning />} preloadV2={Planning.preload} />,
    preload: Planning.preload,
  },
  { path: '/plans/:planId', element: planDashboard, preload: PlanDashboardV2.preload },
  { path: '/plans/:planId/periods/:periodId', element: planDashboard, preload: PlanDashboardV2.preload },
];
