import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

const Dashboard = lazyNamedWithPreload(() => import('@/features/pla-analytics/dashboard/analytics-dashboard'), 'AnalyticsDashboard');
const Reports = lazyNamedWithPreload(() => import('@/features/pla-analytics/reports/reports-page'), 'ReportsV2Page');

/** Overview area: dashboard and reports (analytics track, v2 only). */
export const OVERVIEW_ROUTES: readonly AppRoute[] = [
  { path: '/dashboard', element: <Dashboard />, preload: Dashboard.preload },
  { path: '/reports', element: <Reports />, preload: Reports.preload },
];
