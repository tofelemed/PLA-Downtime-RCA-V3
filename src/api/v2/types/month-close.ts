/**
 * Month close view (backend `src/v2/close/month-close-v2.view.ts`, SME R1 / R4): a plant's financial month
 * with its working-day deadlines, prerequisites, sign-offs, materiality findings and history. Quantities
 * are decimal strings; dates are plant-local `YYYY-MM-DD`, instants ISO 8601 UTC.
 */
export type MonthCloseState = 'open' | 'quantities_closed' | 'finance_signed_off' | 'locked';

export type MonthCloseStep = 'close-quantities' | 'materiality-review' | 'finance-sign-off' | 'lock' | 'reopen';

export interface PersonRef {
  id: string;
  name: string | null;
}

export interface PendingPeriodView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  workflow: string;
}

export interface OpenProposalView {
  proposalId: string;
  periodId: string;
  unitId: string;
  localDate: string;
  trigger: string;
  createdAt: string;
}

export interface MonthCloseActionView {
  id: string;
  action: string;
  fromState: string;
  toState: string;
  actor: PersonRef | null;
  reason: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface MonthCloseView {
  monthKey: string;
  calendar: 'gregorian' | 'persian';
  firstDate: string;
  endDate: string;
  previousMonthKey: string;
  nextMonthKey: string;
  state: MonthCloseState;
  rowVersion: number | null;
  policy: {
    id: string;
    version: number;
    quantitiesCloseWorkingDay: number;
    financeSignOffWorkingDay: number;
    weekendDays: number[];
    blockOnOpenProposals: boolean;
    materialityEnabled: boolean;
    materialityReviewerRoles: string[];
  };
  deadlines: {
    timezone: string;
    quantitiesDue: string;
    quantitiesDueAt: string;
    financeDue: string;
    financeDueAt: string;
    quantitiesOverdue: boolean;
    financeOverdue: boolean;
    holidays: string[];
  };
  signOffs: {
    quantitiesClosedBy: PersonRef | null;
    quantitiesClosedAt: string | null;
    materialityRequired: boolean;
    materialityReviewedBy: PersonRef | null;
    materialityReviewedAt: string | null;
    financeSignedOffBy: PersonRef | null;
    financeSignedOffAt: string | null;
    lockedBy: PersonRef | null;
    lockedAt: string | null;
  };
  prerequisites: {
    met: boolean;
    periods: number;
    approved: number;
    pendingCount: number;
    pending: PendingPeriodView[];
    openProposalCount: number;
    openProposals: OpenProposalView[];
  };
  materiality: {
    findings: Array<{ uom: string; quantity: string; threshold: string }>;
    adjustmentTotals: Array<{ uom: string | null; quantity: string }>;
  };
  reopenCount: number;
  comment: string | null;
  history: MonthCloseActionView[];
  asOf: string;
}
