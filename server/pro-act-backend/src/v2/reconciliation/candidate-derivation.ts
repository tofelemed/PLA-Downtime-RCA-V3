import { EntityManager, In } from 'typeorm';
import { LossLineEvidence } from '../../accounting/entities/loss-line-evidence.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { PeriodLedgerTotal } from '../../accounting/entities/period-ledger-total.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { canon } from '../../reconciliation/reviewed-content';

/** Plan total flag of the engine (plan-ledger.ts, SME Q1). */
const PLANNED_RATE_SCALED = 'planned_rate_scaled';

/** The rate version a time-based candidate was re-based with (as stored on the approved rate row). */
export interface DerivationRateV2View {
  versionId: string;
  /** sustained | planning | … (the rate kind of the version) */
  kind: string | null;
  /** quantity per timebase, decimal string */
  value: string | null;
  timebase: string | null;
}

/** UX D-2: the rate value the engine computed the line with (stored on the line since 2026-10-18). */
export interface AppliedRateV2View {
  /** quantity per timebase, decimal string (the planning rate scaled to target on scaled plan slices) */
  value: string;
  timebase: string | null;
}

/** One cause allocation behind a candidate (`loss_line_evidence`, ACC05). */
export interface DerivationEvidenceV2View {
  eventId: string | null;
  eventRevisionId: string | null;
  occurrenceId: string | null;
  /** share of the segment allocated to this cause, decimal string 0..1 */
  share: string;
  clippedStart: string;
  clippedEnd: string;
}

/**
 * UX D-2: the stored inputs of a candidate as the engine wrote them — no recomputation. Time-based lines
 * (availability, schedule exclusion) are rate × segment seconds × share (× a stream's capacity share, which
 * is not stored); performance and quality lines carry their basis and segment only.
 */
export interface CandidateDerivationV2View {
  basis: string;
  ledger: string;
  segmentStart: string;
  segmentEnd: string;
  durationSeconds: number;
  rate: DerivationRateV2View | null;
  /**
   * SME Q1: the slice's plan total carries `planned_rate_scaled` — plan-ledger candidates used the planning
   * rate scaled so that the slice's eligible time produces its target; `rate.value` is the approved
   * version's value, `appliedRate` the scaled one (when the run stored it)
   */
  rateScaledToTarget: boolean;
  /** the rate the quantity was computed with; null on non-rate lines and lines of runs before it was stored */
  appliedRate?: AppliedRateV2View | null;
  sourceEventId: string | null;
  occurrenceId: string | null;
  evidence: DerivationEvidenceV2View[];
  /** engine flags of the line (e.g. upstream_starvation, origin_unit:<id>) */
  flags: string[];
}

function rateView(
  id: string | null,
  rates: ReadonlyMap<string, UnitProductRate>,
): DerivationRateV2View | null {
  if (!id) return null;
  const rate = rates.get(id);
  return {
    versionId: id,
    kind: rate?.rateKind ?? null,
    value: rate ? canon(rate.rate) : null,
    timebase: rate?.timebase ?? null,
  };
}

function evidenceView(row: LossLineEvidence): DerivationEvidenceV2View {
  return {
    eventId: row.eventId,
    eventRevisionId: row.eventRevisionId,
    occurrenceId: row.occurrenceId,
    share: canon(row.share) ?? '0',
    clippedStart: row.clippedStart.toISOString(),
    clippedEnd: row.clippedEnd.toISOString(),
  };
}

function appliedRateView(line: LossLine): AppliedRateV2View | null {
  const value = canon(line.appliedRate ?? null);
  return value === null
    ? null
    : { value, timebase: line.appliedRateTimebase ?? null };
}

/** The derivation of one candidate from its stored line, evidence rows and rate versions. */
export function derivationOf(
  line: LossLine,
  evidence: readonly LossLineEvidence[],
  rates: ReadonlyMap<string, UnitProductRate>,
  rateScaledToTarget = false,
): CandidateDerivationV2View {
  return {
    basis: line.basis,
    ledger: line.ledger,
    segmentStart: line.segmentStart.toISOString(),
    segmentEnd: line.segmentEnd.toISOString(),
    durationSeconds:
      (line.segmentEnd.getTime() - line.segmentStart.getTime()) / 1000,
    rate: rateView(line.rateVersionId, rates),
    rateScaledToTarget,
    appliedRate: appliedRateView(line),
    sourceEventId: line.causeEventId,
    occurrenceId: line.occurrenceId,
    evidence: evidence.map(evidenceView),
    flags: line.flags ?? [],
  };
}

/** Plan-ledger slices whose candidates used the planning rate scaled to the target (stored total flag). */
export function scaledSliceIds(
  totals: readonly PeriodLedgerTotal[],
): Set<string> {
  return new Set(
    totals
      .filter(
        (t) => t.ledger === 'plan' && t.flags.includes(PLANNED_RATE_SCALED),
      )
      .map((t) => t.sliceId),
  );
}

/** Derivations of a run's candidates by loss line id: two queries (evidence, rate versions), no N+1. */
export async function loadCandidateDerivations(
  manager: EntityManager,
  tenantId: string,
  lines: readonly LossLine[],
  scaledSlices: ReadonlySet<string> = new Set(),
): Promise<Map<string, CandidateDerivationV2View>> {
  if (lines.length === 0) return new Map();
  const rateIds = [
    ...new Set(lines.map((l) => l.rateVersionId).filter(isString)),
  ];
  const [evidence, rates] = await Promise.all([
    manager.find(LossLineEvidence, {
      where: { tenantId, lossLineId: In(lines.map((l) => l.id)) },
      order: { clippedStart: 'ASC', id: 'ASC' },
    }),
    rateIds.length > 0
      ? manager.find(UnitProductRate, {
          where: { tenantId, id: In(rateIds) },
        })
      : Promise.resolve([]),
  ]);
  const byLine = new Map<string, LossLineEvidence[]>();
  for (const row of evidence) {
    byLine.set(row.lossLineId, [...(byLine.get(row.lossLineId) ?? []), row]);
  }
  const rateById = new Map(rates.map((r) => [r.id, r]));
  return new Map(
    lines.map((line) => [
      line.id,
      derivationOf(
        line,
        byLine.get(line.id) ?? [],
        rateById,
        line.ledger === 'plan' && scaledSlices.has(line.sliceId),
      ),
    ]),
  );
}

function isString(value: string | null): value is string {
  return value !== null;
}
