import { lazy, type ComponentType } from 'react';
import type { AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';

export interface OpsReportProps {
  scope: AnalyticsScope;
  dayStart: string;
}

const DailyReport = lazy(() => import('./daily/daily-report').then((m) => ({ default: m.DailyReport })));
const MonthlyStatement = lazy(() => import('./monthly/monthly-statement').then((m) => ({ default: m.MonthlyStatement })));
const QualityReport = lazy(() => import('./quality/quality-report').then((m) => ({ default: m.QualityReport })));
const TransitionsReport = lazy(() => import('./transitions/transitions-report').then((m) => ({ default: m.TransitionsReport })));
const ShiftHandoverReport = lazy(() => import('./shift/shift-handover-report').then((m) => ({ default: m.ShiftHandoverReport })));

/** The operating reports of `plans/REPORTS_R1_R12.md` as Reports page views (`?view=`), each loaded on demand. */
export const OPS_VIEWS: ReadonlyArray<{ key: string; label: string; Report: ComponentType<OpsReportProps> }> = [
  { key: 'daily', label: 'Daily production', Report: DailyReport },
  { key: 'shift', label: 'Shift handover', Report: ShiftHandoverReport },
  { key: 'monthly', label: 'Monthly statement', Report: MonthlyStatement },
  { key: 'quality', label: 'Quality and off-grade', Report: QualityReport },
  { key: 'transitions', label: 'Grade transitions', Report: TransitionsReport },
];
