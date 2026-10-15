import { createHash } from 'crypto';
import { canonicalJson } from '../common/idempotency/idempotency.service';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { SliceReconciliation } from '../domain/reconciliation/reconciliation.types';
import { decOf, RevisionState } from './revision-state';
import { reviewedValuation } from './reviewed-valuation';

/** Canonical decimal string of a stored or computed quantity (no trailing zeros); null stays null. */
export function canon(value: string | number | Dec | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Dec ? value : decOf(value);
  return parsed === null ? null : formatDec(parsed);
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** Per-slice totals as decimal strings (view, snapshot, hash). */
export function sliceView(slice: SliceReconciliation) {
  return {
    sliceId: slice.sliceId,
    uom: slice.uom,
    target: canon(slice.target),
    actual: canon(slice.actual),
    gap: canon(slice.gap),
    attributed: canon(slice.attributed),
    toleranceAdjustment: canon(slice.toleranceAdjustment),
    unadjustedResidual: canon(slice.unadjustedResidual),
    residual: canon(slice.residual),
    overAccounted: canon(slice.overAccounted),
    overproduction: canon(slice.overproduction),
    tolerance: canon(slice.tolerance),
    flags: slice.flags,
  };
}

function runPart(state: RevisionState) {
  const { run } = state;
  if (!run) return null;
  return {
    id: run.id,
    inputHash: run.inputHash,
    engineVersion: run.engineVersion,
    policyVersions: run.policyVersions,
    inputFingerprint: run.inputFingerprint,
    actualsRunId: run.actualsRunId,
  };
}

/** Both ledgers' stored totals of the state's run as decimal strings. */
export function ledgersPart(state: RevisionState) {
  return state.totals.map((t) => ({
    sliceId: t.sliceId,
    ledger: t.ledger,
    uom: t.uom,
    capacity: canon(t.capacityQty),
    exclusion: canon(t.exclusionQty),
    availability: canon(t.availabilityQty),
    performance: canon(t.performanceQty),
    quality: canon(t.qualityQty),
    good: canon(t.goodQty),
    gain: canon(t.gainQty),
    attributed: canon(t.attributedQty),
    residual: canon(t.residualQty),
    target: canon(t.targetQty),
    actual: canon(t.actualQty),
    gap: canon(t.gapQty),
    flags: t.flags,
  }));
}

function actualsPart(state: RevisionState) {
  return state.actuals.map((a) => ({
    resultId: a.id,
    sliceId: a.sliceId,
    gross: canon(a.gross),
    good: canon(a.good),
    reject: canon(a.reject),
    uom: a.uom,
    coverageRatio: canon(a.coverageRatio),
    qualityState: a.qualityState,
  }));
}

/** Candidates of the run with their decision state and effective quantity. */
export function candidatesPart(state: RevisionState) {
  const outcomes = new Map(
    state.reconciliation.candidates.map((c) => [c.autoKey, c]),
  );
  return state.candidateLines.map((line) => {
    const outcome = outcomes.get(line.autoKey ?? line.id);
    return {
      lossLineId: line.id,
      autoKey: line.autoKey,
      sliceId: line.sliceId,
      kind: line.kind,
      quantity: canon(line.quantity),
      basis: line.basis,
      reasonCodeId: line.reasonCodeId,
      impactCodeId: line.impactCodeId,
      causeEventId: line.causeEventId,
      state: outcome?.state ?? 'proposed',
      effectiveQuantity: canon(outcome?.effectiveQuantity ?? null),
    };
  });
}

/** Saved lines with their baseline flags. */
export function linesPart(state: RevisionState) {
  return state.lines.map((line, index) => ({
    id: line.id,
    position: line.position,
    action: line.action,
    autoKey: line.autoKey,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: canon(line.quantity),
    baseQuantity: canon(line.baseQuantity),
    uom: line.uom,
    basis: line.basis,
    reasonCodeId: line.reasonCodeId,
    impactCodeId: line.impactCodeId,
    evidence: line.evidence,
    adjustmentId: line.adjustmentId,
    missingCode: line.missingCode,
    missingEvent: line.missingEvent,
    // SME R7 / R8 / R11 fields only when set, so the content hash of older lines is unchanged
    ...(line.classification ? { classification: line.classification } : {}),
    ...(line.evidenceType ? { evidenceType: line.evidenceType } : {}),
    ...(line.evidenceRef ? { evidenceRef: line.evidenceRef } : {}),
    // SME R9 (15 Oct 2026), same rule
    ...(line.reversesLineId ? { reversesLineId: line.reversesLineId } : {}),
    reason: line.reason,
    comment: line.comment,
    authorId: line.authorId,
    flags: state.reconciliation.lineFlags[index] ?? [],
  }));
}

/**
 * The content a reviewer approves (WF02/WF03): period and revision identity, the run with its input
 * fingerprint, engine and policy versions, the actuals results, both ledgers' totals, the candidates with
 * their decisions, the saved lines, the tolerance policy, the per-slice reconciliation and (plan 2.6) its
 * valuation from the run's frozen context. Built only from
 * stored rows, so it is reproducible: its sha256 is the content hash shown to the editor and, after
 * submission, the submitted hash an approval must match.
 */
export function reviewedContent(state: RevisionState): Record<string, unknown> {
  const { period, revision, lineSet, tolerance } = state;
  return {
    periodId: period.id,
    unitId: period.unitId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    revisionId: revision.id,
    revision: revision.revision,
    supersedesId: revision.supersedesId,
    run: runPart(state),
    lineSet: lineSet
      ? {
          id: lineSet.id,
          version: lineSet.version,
          baseRunId: lineSet.baseRunId,
        }
      : null,
    tolerance: {
      policyId: tolerance.policyId,
      version: tolerance.version,
      ...tolerance.body,
    },
    actuals: actualsPart(state),
    ledgers: ledgersPart(state),
    candidates: candidatesPart(state),
    lines: linesPart(state),
    slices: state.reconciliation.slices.map(sliceView),
    ...valuationPart(state),
  };
}

/** Plan 2.6: the reviewed valuation, omitted for runs before 2.6 so their content hash is unchanged. */
function valuationPart(state: RevisionState) {
  const valuation = reviewedValuation(state);
  return valuation ? { valuation } : {};
}

export function contentHashOf(state: RevisionState): string {
  return sha256(reviewedContent(state));
}
