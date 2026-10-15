/**
 * Production day views (backend `src/v2/close/production-day.view.ts`; owner decision 14 Oct 2026, SME R2):
 * the shift periods of a unit's day, its certification and the roll-up of the approved shifts.
 */
export type DayState = 'open' | 'ready' | 'certified';

export interface DayCertificationView {
  id: string;
  state: 'certified' | 'reopened';
  certifiedBy: string;
  certifiedAt: string;
  comment: string | null;
  revisions: Array<{ periodId: string; revisionId: string; revision: number }>;
  rollupHash: string;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
}

export interface DayView {
  unitId: string;
  localDate: string;
  state: DayState;
  periods: Array<{ periodId: string; shiftName: string | null; utcStart: string; isExcluded: boolean; workflow: string; revision: number | null; submittedBy: string | null }>;
  certification: DayCertificationView | null;
  rollup: Array<{ uom: string | null; periods: number; target: string | null; actual: string | null; gap: string | null; attributed: string | null; residual: string | null }>;
}
