import { lazyNamedWithPreload, lazyWithPreload } from '@/lib/lazy-with-preload';
import { FlaggedRoute } from '@/features/v2-foundation/flagged-route';
import type { AppRoute } from './route-types';

const DashboardV1 = lazyWithPreload(() => import('@/pages/Dashboard'));
const ReportsV1 = lazyWithPreload(() => import('@/pages/Reports'));
/** PLA Analytics, Reports and the Dashboard on v2 (plan 3.6), served while `v2.plaAnalytics` is on. */
const DashboardV2 = lazyNamedWithPreload(() => import('@/features/pla-analytics/dashboard/analytics-dashboard'), 'AnalyticsDashboard');
const ReportsV2 = lazyNamedWithPreload(() => import('@/features/pla-analytics/reports/reports-page'), 'ReportsV2Page');

/** Overview area: dashboard and reports (analytics track). */
export const OVERVIEW_ROUTES: readonly AppRoute[] = [
  {
    path: '/dashboard',
    element: <FlaggedRoute flag="v2.plaAnalytics" v1={<DashboardV1 />} v2={<DashboardV2 />} preloadV2={DashboardV2.preload} />,
    preload: DashboardV2.preload,
  },
  {
    path: '/reports',
    element: <FlaggedRoute flag="v2.plaAnalytics" v1={<ReportsV1 />} v2={<ReportsV2 />} preloadV2={ReportsV2.preload} />,
    preload: ReportsV2.preload,
  },
];
