import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import {
  CalculationRun,
  InputFingerprint,
  RunError,
} from '../../accounting/entities/calculation-run.entity';
import { LossLineEvidence } from '../../accounting/entities/loss-line-evidence.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { PeriodLedgerTotal } from '../../accounting/entities/period-ledger-total.entity';
import { PolicyVersionRef } from '../../periods/entities/actuals-run.entity';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { toDecimalString as rawDecimal } from '../common/decimal-string.transformer';

/** Canonical decimal string (no trailing zeros), whatever the driver returned; null stays null. */
function toDecimalString(value: unknown): string | null {
  const raw = rawDecimal(value);
  return raw === null ? null : formatDec(new Dec(raw));
}

export interface RevisionV2View {
  id: string;
  revision: number;
  lifecycle: string;
  currentRunId: string | null;
}

export interface RunV2View {
  id: string;
  revisionId: string;
  status: string;
  trigger: string;
  engineVersion: string;
  policyVersions: PolicyVersionRef[];
  inputHash: string;
  inputFingerprint: InputFingerprint;
  actualsRunId: string | null;
  supersedesRunId: string | null;
  startedAt: string;
  completedAt: string | null;
  error: RunError[] | null;
  stats: Record<string, number>;
}

export interface EvidenceV2View {
  eventId: string | null;
  eventRevisionId: string | null;
  observationId: string | null;
  occurrenceId: string | null;
  share: string | null;
  clippedStart: string;
  clippedEnd: string;
}

export interface LossLineV2View {
  id: string;
  ledger: string;
  kind: string;
  sliceId: string;
  segmentStart: string;
  segmentEnd: string;
  /** signed decimal string: negative only for residual / gain / bridge */
  quantity: string | null;
  uom: string | null;
  basis: string;
  rateVersionId: string | null;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  oeeComponent: string | null;
  scheduleClass: string | null;
  source: string;
  state: string;
  autoKey: string | null;
  causeEventId: string | null;
  occurrenceId: string | null;
  flags: string[];
  evidence: EvidenceV2View[];
}

export interface LedgerTotalsV2View {
  sliceId: string;
  ledger: string;
  uom: string | null;
  capacity: string | null;
  exclusion: string | null;
  availability: string | null;
  performance: string | null;
  quality: string | null;
  good: string | null;
  gain: string | null;
  attributed: string | null;
  residual: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  overproduction: string | null;
  overAccounted: string | null;
  flags: string[];
}

export interface PeriodAccountingV2View {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  /** D04: the ledger the period UI opens on (both are always computed) */
  defaultLedgerView: string | null;
  revision: RevisionV2View | null;
  run: RunV2View | null;
  totals: LedgerTotalsV2View[];
  lines: LossLineV2View[];
  /** lowest actuals coverage ratio of the slices (the run's actuals run); null without a run */
  coverageRatio: number | null;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function toRevisionView(revision: AccountingRevision): RevisionV2View {
  return {
    id: revision.id,
    revision: revision.revision,
    lifecycle: revision.lifecycle,
    currentRunId: revision.currentRunId,
  };
}

export function toRunView(run: CalculationRun): RunV2View {
  return {
    id: run.id,
    revisionId: run.revisionId,
    status: run.status,
    trigger: run.trigger,
    engineVersion: run.engineVersion,
    policyVersions: run.policyVersions,
    inputHash: run.inputHash,
    inputFingerprint: run.inputFingerprint,
    actualsRunId: run.actualsRunId,
    supersedesRunId: run.supersedesRunId,
    startedAt: run.startedAt.toISOString(),
    completedAt: iso(run.completedAt),
    error: run.error,
    stats: run.stats,
  };
}

function toEvidenceView(evidence: LossLineEvidence): EvidenceV2View {
  return {
    eventId: evidence.eventId,
    eventRevisionId: evidence.eventRevisionId,
    observationId: evidence.observationId,
    occurrenceId: evidence.occurrenceId,
    share: toDecimalString(evidence.share),
    clippedStart: evidence.clippedStart.toISOString(),
    clippedEnd: evidence.clippedEnd.toISOString(),
  };
}

export function toLineView(
  line: LossLine,
  evidence: readonly LossLineEvidence[],
): LossLineV2View {
  return {
    id: line.id,
    ledger: line.ledger,
    kind: line.kind,
    sliceId: line.sliceId,
    segmentStart: line.segmentStart.toISOString(),
    segmentEnd: line.segmentEnd.toISOString(),
    quantity: toDecimalString(line.quantity),
    uom: line.uom,
    basis: line.basis,
    rateVersionId: line.rateVersionId,
    reasonCodeId: line.reasonCodeId,
    impactCodeId: line.impactCodeId,
    oeeComponent: line.oeeComponent,
    scheduleClass: line.scheduleClass,
    source: line.source,
    state: line.state,
    autoKey: line.autoKey,
    causeEventId: line.causeEventId,
    occurrenceId: line.occurrenceId,
    flags: line.flags,
    evidence: evidence
      .filter((e) => e.lossLineId === line.id)
      .map(toEvidenceView),
  };
}

export function toTotalsView(totals: PeriodLedgerTotal): LedgerTotalsV2View {
  return {
    sliceId: totals.sliceId,
    ledger: totals.ledger,
    uom: totals.uom,
    capacity: toDecimalString(totals.capacityQty),
    exclusion: toDecimalString(totals.exclusionQty),
    availability: toDecimalString(totals.availabilityQty),
    performance: toDecimalString(totals.performanceQty),
    quality: toDecimalString(totals.qualityQty),
    good: toDecimalString(totals.goodQty),
    gain: toDecimalString(totals.gainQty),
    attributed: toDecimalString(totals.attributedQty),
    residual: toDecimalString(totals.residualQty),
    target: toDecimalString(totals.targetQty),
    actual: toDecimalString(totals.actualQty),
    gap: toDecimalString(totals.gapQty),
    overproduction: toDecimalString(totals.overproductionQty),
    overAccounted: toDecimalString(totals.overAccountedQty),
    flags: totals.flags,
  };
}
