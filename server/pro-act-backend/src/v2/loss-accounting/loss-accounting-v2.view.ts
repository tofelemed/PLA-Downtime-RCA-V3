import { isSelfDecision } from '../../domain/approvals/self-decision';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import {
  LossAccountingPolicy,
  parseLossAccounting,
} from '../../periods/loss-accounting-policy';
import { LossAccountingInForce } from './loss-accounting-v2.service';
import { DailyCalendarResult } from './loss-accounting-calendar.service';
import {
  SourceAuthorityVersionState as LossAccountingVersionState,
  versionStateOf,
} from '../source-authority/source-authority-v2.view';

/** The loss accounting version in force as the v2 API returns it. */
export interface LossAccountingV2View {
  policyId: string;
  version: number;
  unitId: string | null;
  effectiveFrom: string;
  notes: string | null;
  policy: LossAccountingPolicy;
}

/** One loss accounting version (draft, approved or rejected) as the v2 API returns it. */
export interface LossAccountingVersionV2View {
  id: string;
  version: number;
  /** null = tenant-wide */
  unitId: string | null;
  state: LossAccountingVersionState;
  /** approved and in force now for its scope */
  inForce: boolean;
  /** a draft's is its creation; approval moves it to the approval instant (or the requested backdate) */
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the version in force the draft was prepared from */
  basedOnId: string | null;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  /** approved or rejected by its own author: a SuperAdmin self-decision */
  selfDecided: boolean;
  notes: string | null;
  /** commissioning backdate: the past instant it takes effect from on approval, and why (null = approval time) */
  requestedEffectiveFrom: string | null;
  backdateReason: string | null;
  policy: LossAccountingPolicy;
}

/** What approving a day-grain version did to the calendar of its scope. */
export interface LossAccountingCalendarV2View {
  /** the daily calendar version (published by this approval, or already in force) */
  versionId: string;
  /** its first operational date: the first `dayStart` after the last calculated period, never before the policy's */
  effectiveFrom: string;
  /** open periods deleted so daily periods take their place */
  retired: number;
  /** days left to the old periods because one of them has calculation history */
  kept: number;
}

/** The approve response: the version, and for a day-grain version the daily calendar (null otherwise). */
export interface LossAccountingApprovalV2View
  extends LossAccountingVersionV2View {
  calendar: LossAccountingCalendarV2View | null;
}

const iso = (value: Date | null): string | null =>
  value ? new Date(value).toISOString() : null;

export function toLossAccountingView(
  found: LossAccountingInForce,
): LossAccountingV2View {
  return {
    policyId: found.row.id,
    version: found.row.version,
    unitId: found.row.unitId,
    effectiveFrom: new Date(found.row.effectiveFrom).toISOString(),
    notes: found.row.notes,
    policy: found.body,
  };
}

export function toLossAccountingVersionView(
  row: AccountingPolicy,
  now: Date = new Date(),
): LossAccountingVersionV2View {
  const state = versionStateOf(row);
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return {
    id: row.id,
    version: row.version,
    unitId: row.unitId,
    state,
    inForce: state === 'approved' && from <= now && (!to || to > now),
    effectiveFrom: from.toISOString(),
    effectiveTo: iso(to),
    basedOnId: row.basedOnId,
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    rejectedBy: row.rejectedBy,
    rejectedAt: iso(row.rejectedAt),
    rejectionReason: row.rejectionReason,
    selfDecided: isSelfDecision(row.approvedBy ?? row.rejectedBy, [
      row.createdBy,
    ]),
    notes: row.notes,
    requestedEffectiveFrom: iso(row.requestedEffectiveFrom),
    backdateReason: row.backdateReason,
    policy: parseLossAccounting(row.body),
  };
}

export function toLossAccountingApprovalView(
  row: AccountingPolicy,
  daily: DailyCalendarResult | null,
): LossAccountingApprovalV2View {
  return {
    ...toLossAccountingVersionView(row),
    calendar: daily && {
      versionId: daily.calendarVersionId,
      effectiveFrom: daily.effectiveFrom,
      retired: daily.retired,
      kept: daily.keptInstances,
    },
  };
}
