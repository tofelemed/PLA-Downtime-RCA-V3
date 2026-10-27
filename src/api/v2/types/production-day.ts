import type { LossBasis } from './loss-accounting';
import type { CodingGateView } from './stop-coding';

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
  /** item 1.3: server-derived SuperAdmin self-decision (owner decision 2026-10-16); absent from older servers */
  selfDecided?: boolean;
}

export interface DayView {
  unitId: string;
  localDate: string;
  state: DayState;
  /** the day is one period spanning the whole operational day (daily accounting grain), else shifts */
  isDayGrain: boolean;
  periods: Array<{ periodId: string; shiftName: string | null; utcStart: string; isExcluded: boolean; workflow: string; revision: number | null; submittedBy: string | null }>;
  certification: DayCertificationView | null;
  rollup: Array<{ uom: string | null; periods: number; target: string | null; actual: string | null; gap: string | null; attributed: string | null; residual: string | null }>;
  /** SME D12 daily target: the server's verdict over the day's stops (`dayGate`, warn at 99 % by default) */
  codingGate: CodingGateView | null;
  /** loss basis of the day's current runs; null = no run yet (read the policy in force) */
  lossBasis: LossBasis | null;
}
