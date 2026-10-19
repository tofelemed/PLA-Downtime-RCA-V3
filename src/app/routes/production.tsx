import { DOWNTIME_PAGES, PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';
import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import { PLANNING_ROUTES } from './production-planning';
import type { AppRoute } from './route-types';

/** Event Hub (plan 3.2): list, event pages, the event form (event writers only) and the RCA trigger settings. */
const EventHub = lazyNamedWithPreload(() => import('@/features/event-hub/event-hub-page'), 'EventHubPage');
const EventDetail = lazyNamedWithPreload(() => import('@/features/event-hub/event-detail-page'), 'EventDetailPage');
const EventForm = lazyNamedWithPreload(() => import('@/features/event-hub/event-form-page'), 'EventFormPage');
const RcaTriggerSettings = lazyNamedWithPreload(() => import('@/features/event-hub/rca-policy/rca-policy-page'), 'RcaPolicyPage');
/** Downtime Analysis (plan 3.3). */
const DowntimeAnalysis = lazyNamedWithPreload(() => import('@/features/downtime-analysis/downtime-page'), 'DowntimeAnalysisPage');
const PlaAnalyticsV2 = lazyNamedWithPreload(() => import('@/features/pla-analytics/pla-analytics-page'), 'PlaAnalyticsPage');

/** Production area: events, downtime, loss analysis, plans and planning (tracks T1, T2, T6). */
export const PRODUCTION_ROUTES: readonly AppRoute[] = [
  { path: '/events', element: <EventHub />, preload: EventHub.preload },
  { path: '/events/new', element: <EventForm />, preload: EventForm.preload, requires: 'canWriteEvents', gateTitle: 'New event' },
  { path: '/events/rca-triggers', element: <RcaTriggerSettings />, preload: RcaTriggerSettings.preload },
  { path: '/events/:eventId', element: <EventDetail />, preload: EventDetail.preload },
  { path: '/events/:eventId/edit', element: <EventForm />, preload: EventForm.preload, requires: 'canWriteEvents', gateTitle: 'Edit event' },
  ...DOWNTIME_PAGES.map((page) => ({ path: page.path, element: <DowntimeAnalysis />, preload: DowntimeAnalysis.preload })),
  ...PLA_PAGES.map((page) => ({ path: page.path, element: <PlaAnalyticsV2 />, preload: PlaAnalyticsV2.preload })),
  ...PLANNING_ROUTES,
];
