import { Navigate } from 'react-router-dom';
import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

/** Plans, profiles & calendars: the list page and its record / form sub-pages. */
const Planning = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/planning-page'), 'PlanningPage');
const PlanPage = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/plans/plan-page'), 'PlanPage');
const NewPlan = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/plans/plan-form-page'), 'NewPlanPage');
const EditPlanVersion = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/plans/plan-form-page'), 'EditPlanVersionPage');
const NewPlanVersion = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/plans/plan-form-page'), 'NewPlanVersionPage');
const ProfilePage = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/profiles/profile-page'), 'ProfilePage');
const NewProfile = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/profiles/profile-editor-page'), 'NewProfilePage');
const EditProfile = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/profiles/profile-editor-page'), 'EditProfilePage');
const RateImport = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/profiles/rate-import-page'), 'RateImportPage');
const CalendarVersion = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/calendars/calendar-editor-page'), 'CalendarVersionPage');
const NewCalendarVersion = lazyNamedWithPreload(() => import('@/features/plans-profiles-calendars/calendars/calendar-editor-page'), 'NewCalendarVersionPage');
/** Period accounting of a plan: the period grid, one period's workspace and the adjustment form. */
const PlanDashboard = lazyNamedWithPreload(() => import('@/features/plan-dashboard/plan-dashboard-page'), 'PlanDashboardPage');
const PeriodPage = lazyNamedWithPreload(() => import('@/features/plan-dashboard/period-page'), 'PeriodPage');
/** Month close of the plant (EXPERT_REVIEW Area 3, phase R-B). */
const MonthClose = lazyNamedWithPreload(() => import('@/features/month-close/month-close-page'), 'MonthClosePage');
/** "My queue" of the reconciliation workflow (EXPERT_REVIEW Area 3, phase R-C). */
const MyQueue = lazyNamedWithPreload(() => import('@/features/month-close/my-queue-page'), 'MyQueuePage');
const ProposeAdjustment = lazyNamedWithPreload(() => import('@/features/plan-dashboard/adjustments/propose-adjustment-page'), 'ProposeAdjustmentPage');
const RecordDisposition = lazyNamedWithPreload(() => import('@/features/plan-dashboard/dispositions/record-disposition-page'), 'RecordDispositionPage');
/** SME E4 uncertainty budgets per measurement boundary (justification of the reconciliation tolerance). */
const MeasurementUncertainty = lazyNamedWithPreload(() => import('@/features/measurement-uncertainty/uncertainty-page'), 'UncertaintyPage');

/**
 * Planning routes of the production area (owned by the planning track; spread into `PRODUCTION_ROUTES`).
 * The old `/production-plans` list now lives in `/planning?tab=plans`; its links keep working.
 */
export const PLANNING_ROUTES: readonly AppRoute[] = [
  { path: '/production-plans', element: <Navigate to="/planning?tab=plans" replace />, preload: Planning.preload },
  { path: '/planning', element: <Planning />, preload: Planning.preload },
  { path: '/planning/plans/new', element: <NewPlan />, preload: NewPlan.preload },
  { path: '/planning/plans/:planId', element: <PlanPage />, preload: PlanPage.preload },
  { path: '/planning/plans/:planId/versions/new', element: <NewPlanVersion />, preload: NewPlanVersion.preload },
  { path: '/planning/plans/:planId/versions/:version/edit', element: <EditPlanVersion />, preload: EditPlanVersion.preload },
  { path: '/planning/profiles/new', element: <NewProfile />, preload: NewProfile.preload },
  { path: '/planning/profiles/import', element: <RateImport />, preload: RateImport.preload },
  { path: '/planning/profiles/:profileId', element: <ProfilePage />, preload: ProfilePage.preload },
  { path: '/planning/profiles/:profileId/edit', element: <EditProfile />, preload: EditProfile.preload },
  { path: '/planning/calendars/new', element: <NewCalendarVersion />, preload: NewCalendarVersion.preload },
  { path: '/planning/calendars/:versionId/edit', element: <CalendarVersion />, preload: CalendarVersion.preload },
  { path: '/plans/:planId', element: <PlanDashboard />, preload: PlanDashboard.preload },
  { path: '/plans/:planId/periods/:periodId/*', element: <PeriodPage />, preload: PeriodPage.preload },
  { path: '/plans/:planId/periods/:periodId/adjustments/new', element: <ProposeAdjustment />, preload: ProposeAdjustment.preload },
  { path: '/plans/:planId/periods/:periodId/dispositions/new', element: <RecordDisposition />, preload: RecordDisposition.preload },
  { path: '/month-close', element: <MonthClose />, preload: MonthClose.preload },
  { path: '/my-queue', element: <MyQueue />, preload: MyQueue.preload },
  { path: '/measurement-uncertainty', element: <MeasurementUncertainty />, preload: MeasurementUncertainty.preload },
];
