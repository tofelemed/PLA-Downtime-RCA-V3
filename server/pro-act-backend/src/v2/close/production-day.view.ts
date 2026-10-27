import { DaySnapshot, DaySummary } from '../../close/day-certification.service';
import { DayCertification } from '../../close/entities/day-certification.entity';
import { isSelfDecision } from '../../domain/approvals/self-decision';
import { DayRollup } from '../../domain/close/day-certification';
import { CodingGateResult } from '../../domain/reconciliation/coding-gate';
import { spansOperationalDay } from '../../periods/day-grain';
import { LossBasis } from '../../periods/loss-accounting-policy';
import type { DayStatementView } from '../loss-statement/loss-statement-v2.service';

export interface DayCertificationV2View {
  id: string;
  state: string;
  certifiedBy: string;
  certifiedAt: string;
  comment: string | null;
  revisions: Array<{ periodId: string; revisionId: string; revision: number }>;
  rollupHash: string;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  /** item 1.3: certified by a submitter of one of the day's shift periods (SuperAdmin only) */
  selfDecided: boolean;
}

export interface DaySummaryV2View {
  unitId: string;
  localDate: string;
  /** open | ready | certified */
  state: string;
  /** the day is one period spanning the whole operational day (daily accounting grain), else shifts */
  isDayGrain: boolean;
  periods: Array<{
    periodId: string;
    shiftName: string | null;
    utcStart: string;
    isExcluded: boolean;
    workflow: string;
    revision: number | null;
    submittedBy: string | null;
  }>;
  certification: DayCertificationV2View | null;
}

/** `GET /v2/production-days/:unitId/:localDate`: the day with the roll-up of its approved shifts. */
export interface DayV2View extends DaySummaryV2View {
  rollup: DayRollup[];
  /** SME D12 daily target: the day's stop coding against `dayGate` (null = no period) */
  codingGate: CodingGateResult | null;
  /** loss basis of the day's current runs (their policy snapshots); null = no run yet */
  lossBasis: LossBasis | null;
  /**
   * Task 13: the day's loss accounting statement — its periods' shown revisions (approved, else the open
   * draft, marked provisional) summed server-side; `incomplete` = periods left out
   */
  accounting: DayStatementView;
}

function certificationView(
  c: DayCertification | null,
  submitters: ReadonlyArray<string | null>,
): DayCertificationV2View | null {
  if (!c) return null;
  return {
    id: c.id,
    state: c.state,
    certifiedBy: c.certifiedBy,
    certifiedAt: c.certifiedAt.toISOString(),
    comment: c.comment,
    revisions: c.revisions,
    rollupHash: c.rollupHash,
    reopenedBy: c.reopenedBy,
    reopenedAt: c.reopenedAt ? c.reopenedAt.toISOString() : null,
    reopenReason: c.reopenReason,
    selfDecided:
      c.state === 'certified' && isSelfDecision(c.certifiedBy, submitters),
  };
}

export function toDaySummaryView(day: DaySummary): DaySummaryV2View {
  return {
    unitId: day.unitId,
    localDate: day.localDate,
    state: day.state,
    isDayGrain:
      day.periods.length > 0 &&
      day.periods.every((p) => spansOperationalDay(p.utcStart, p.utcEnd)),
    periods: day.periods.map((p) => ({
      periodId: p.periodId,
      shiftName: p.shiftName,
      utcStart: p.utcStart.toISOString(),
      isExcluded: p.isExcluded,
      workflow: p.workflow,
      revision: p.revision,
      submittedBy: p.submittedBy,
    })),
    certification: certificationView(
      day.certification,
      day.periods.map((p) => p.submittedBy),
    ),
  };
}

export function toDayView(day: DaySnapshot): Omit<DayV2View, 'accounting'> {
  return {
    ...toDaySummaryView(day),
    rollup: day.rollup,
    codingGate: day.codingGate,
    lossBasis: day.lossBasis,
  };
}
