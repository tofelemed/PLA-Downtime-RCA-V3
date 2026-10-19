import { MissingPeriod } from '../../close/month-coverage';
import { UncoveredDay } from '../../close/month-uncovered';
import { MonthCloseSnapshot } from '../../close/month-close.service';
import {
  OpenProposal,
  PendingPeriod,
  UncertifiedDay,
} from '../../close/month-prerequisites';
import { localDateOf } from '../../close/close-calendar';
import { addDays } from '../../domain/calendar/wall-clock';
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
  /** the month's last date (display) */
  lastDate: string;
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
    requireCertifiedDays: boolean;
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
    /** scheduled shifts of the month without a production period yet (each blocks the close) */
    missingPeriodCount: number;
    missingPeriods: MissingPeriod[];
    /** the month is over in the plant time zone (its last shift ended): the quantity close needs it */
    monthEnded: boolean;
    monthEndsAt: string;
    /** the month's first plant-local date has begun (additive, QA re-test: a future month says so) */
    monthStarted: boolean;
    /** production days (unit × date) and the certified ones (owner decision: day certification) */
    days: number;
    certifiedDays: number;
    uncertifiedDays: UncertifiedDay[];
    openProposalCount: number;
    openProposals: OpenProposal[];
    /**
     * information, never a prerequisite: production days with periods or scheduled shifts that no approved
     * plan covers (owner decision 2026-10-19); they are left out of every count above until planned
     */
    uncoveredDayCount: number;
    uncoveredDays: UncoveredDay[];
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

/** Whether the month has begun: the plant-local date of `asOf` is on or after its first date. */
export function monthStartedAt(
  asOf: Date,
  firstDate: string,
  timezone: string,
): boolean {
  return localDateOf(asOf, timezone) >= firstDate;
}

function prerequisitesOf(
  snapshot: MonthCloseSnapshot,
): MonthCloseV2View['prerequisites'] {
  const p = snapshot.prerequisites;
  const policy = snapshot.context.policy.policy;
  const proposalsBlock = policy.blockOnOpenProposals && p.openProposalCount > 0;
  const daysBlock = policy.requireCertifiedDays && p.certifiedDays < p.days;
  const monthEnded = snapshot.asOf >= snapshot.endsAt;
  const complete = p.pendingCount === 0 && p.missingPeriodCount === 0;
  return {
    met: complete && monthEnded && !proposalsBlock && !daysBlock,
    ...p,
    monthEnded,
    monthEndsAt: snapshot.endsAt.toISOString(),
    monthStarted: monthStartedAt(
      snapshot.asOf,
      snapshot.context.month.firstDate,
      snapshot.context.calendar.timezone,
    ),
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
    lastDate: addDays(context.month.endDate, -1),
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
      requireCertifiedDays: policy.requireCertifiedDays,
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
