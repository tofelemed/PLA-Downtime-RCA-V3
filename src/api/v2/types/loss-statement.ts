import type { LossBasis } from './loss-accounting';

/**
 * Task 13 (owner requirement, 27 Oct 2026): the loss accounting statement of a period, a day or a window,
 * decimal strings computed by the server (backend `src/v2/loss-statement/loss-statement.ts`). Identity:
 * `shortfall = netAccounted + toleranceAdjustment + unaccounted`, `netAccounted = grossAttributed − recovery`.
 */
export interface LossStatementView {
  planned: string | null;
  actual: string | null;
  shortfall: string | null;
  availability: string;
  performance: string;
  quality: string;
  transitionExcess: string;
  unaccountedClassified: string;
  grossAttributed: string;
  /** verified recovery, a positive figure (shown with a minus sign) */
  recovery: string;
  /** false while a declared recovery share's event coding is not verified ("Recovery (unverified)") */
  recoveryVerified: boolean;
  netAccounted: string;
  toleranceAdjustment: string;
  unaccounted: string | null;
  uom: string | null;
  revisionState: 'approved' | 'provisional';
}

/** One row of the statement report: a period (a day, or a shift grouped under its day). */
export interface LossStatementRowView {
  periodId: string;
  planId: string | null;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  grain: 'day' | 'shift';
  basis: LossBasis | null;
  revisionState: 'approved' | 'provisional' | null;
  statement: LossStatementView | null;
}

/** `GET /v2/reports/loss-statement` data. */
export interface LossStatementReportView {
  /** page one only (null when a cursor was sent, or no complete period / mixed units) */
  total: LossStatementView | null;
  /** page one only (null on later pages) */
  incomplete: number | null;
  items: LossStatementRowView[];
  nextCursor: string | null;
}

/** The day's statement on the production day view (`accounting`). */
export interface DayStatementView {
  statement: LossStatementView | null;
  incomplete: number;
}
