import { MonthCloseSnapshot } from '../../close/month-close.service';
import { OpenProposal, PendingPeriod } from '../../close/month-prerequisites';
import { nextMonth, previousMonth } from '../../domain/close/financial-month';
import {
  AdjustmentTotal,
  MaterialityFinding,
} from '../../domain/close/materiality';
import { overdueStages } from '../../domain/close/month-close-machine';

export interface PersonV2View {
  id: string;
  name: string | null;
}

export interface MonthCloseActionV2View {
  id: string;
  action: string;
  fromState: string;
  toState: string;
  actor: PersonV2View | null;
  reason: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

/** `GET /v2/month-closes/:month` — a plant's financial month close (SME R1 / R4). */
export interface MonthCloseV2View {
  monthKey: string;
  calendar: string;
  firstDate: string;
  /** first date after the month (exclusive) */
  endDate: string;
  previousMonthKey: string;
  nextMonthKey: string;
  state: string;
  /** null while the month was never acted on */
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
    quantitiesClosedBy: PersonV2View | null;
    quantitiesClosedAt: string | null;
    materialityRequired: boolean;
    materialityReviewedBy: PersonV2View | null;
    materialityReviewedAt: string | null;
    financeSignedOffBy: PersonV2View | null;
    financeSignedOffAt: string | null;
    lockedBy: PersonV2View | null;
    lockedAt: string | null;
  };
  prerequisites: {
    met: boolean;
    periods: number;
    approved: number;
    pendingCount: number;
    pending: PendingPeriod[];
    openProposalCount: number;
    openProposals: OpenProposal[];
  };
  materiality: {
    findings: MaterialityFinding[];
    adjustmentTotals: AdjustmentTotal[];
  };
  reopenCount: number;
  comment: string | null;
  history: MonthCloseActionV2View[];
  asOf: string;
}

const iso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

function personOf(
  id: string | null | undefined,
  names: Record<string, string>,
): PersonV2View | null {
  return id ? { id, name: names[id] ?? null } : null;
}

function signOffsOf(
  snapshot: MonthCloseSnapshot,
): MonthCloseV2View['signOffs'] {
  const row = snapshot.context.row;
  const names = snapshot.names;
  return {
    quantitiesClosedBy: personOf(row?.quantitiesClosedBy, names),
    quantitiesClosedAt: iso(row?.quantitiesClosedAt),
    materialityRequired: row?.materialityRequired ?? false,
    materialityReviewedBy: personOf(row?.materialityReviewedBy, names),
    materialityReviewedAt: iso(row?.materialityReviewedAt),
    financeSignedOffBy: personOf(row?.financeSignedOffBy, names),
    financeSignedOffAt: iso(row?.financeSignedOffAt),
    lockedBy: personOf(row?.lockedBy, names),
    lockedAt: iso(row?.lockedAt),
  };
}

function deadlinesOf(
  snapshot: MonthCloseSnapshot,
): MonthCloseV2View['deadlines'] {
  const { context, asOf } = snapshot;
  const state = context.row?.state ?? 'open';
  return {
    timezone: context.calendar.timezone,
    quantitiesDue: context.deadlines.quantitiesDue,
    quantitiesDueAt: context.dueAt.quantities.toISOString(),
    financeDue: context.deadlines.financeDue,
    financeDueAt: context.dueAt.finance.toISOString(),
    ...overdueStages(state, context.dueAt, asOf),
    holidays: [...context.calendar.working.holidays].sort(),
  };
}

function prerequisitesOf(
  snapshot: MonthCloseSnapshot,
): MonthCloseV2View['prerequisites'] {
  const p = snapshot.prerequisites;
  const blocksOnProposals = snapshot.context.policy.policy.blockOnOpenProposals;
  return {
    met:
      p.pendingCount === 0 && !(blocksOnProposals && p.openProposalCount > 0),
    ...p,
  };
}

export function toMonthCloseView(
  snapshot: MonthCloseSnapshot,
): MonthCloseV2View {
  const { context } = snapshot;
  const { policy } = context.policy;
  return {
    monthKey: context.month.key,
    calendar: context.month.calendar,
    firstDate: context.month.firstDate,
    endDate: context.month.endDate,
    previousMonthKey: previousMonth(context.month).key,
    nextMonthKey: nextMonth(context.month).key,
    state: context.row?.state ?? 'open',
    rowVersion: context.row?.rowVersion ?? null,
    policy: {
      id: context.policy.id,
      version: context.policy.version,
      quantitiesCloseWorkingDay: policy.quantitiesCloseWorkingDay,
      financeSignOffWorkingDay: policy.financeSignOffWorkingDay,
      weekendDays: policy.weekendDays,
      blockOnOpenProposals: policy.blockOnOpenProposals,
      materialityEnabled: policy.materiality.enabled,
      materialityReviewerRoles: policy.materiality.reviewerRoles,
    },
    deadlines: deadlinesOf(snapshot),
    signOffs: signOffsOf(snapshot),
    prerequisites: prerequisitesOf(snapshot),
    materiality: {
      findings: snapshot.findings,
      adjustmentTotals: snapshot.totals,
    },
    reopenCount: context.row?.reopenCount ?? 0,
    comment: context.row?.comment ?? null,
    history: snapshot.history.map((h) => ({
      id: h.id,
      action: h.action,
      fromState: h.fromState,
      toState: h.toState,
      actor: personOf(h.actorId, snapshot.names),
      reason: h.reason,
      detail: h.detail,
      createdAt: h.createdAt.toISOString(),
    })),
    asOf: snapshot.asOf.toISOString(),
  };
}
