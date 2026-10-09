import { clip, union, unionSeconds } from '../../time/interval-algebra';
import { Dec, formatDec, ZERO } from '../decimal';
import { AuthoritySelection } from './authority';
import {
  ActualsMethod,
  ApprovedAdjustment,
  CoverageGatePolicy,
  PeriodFinding,
  QualityState,
  QuantityBasis,
  SliceActuals,
  SourceCandidate,
  Window,
} from './period-actuals.types';

export interface SliceActualsInput {
  window: Window;
  gate: CoverageGatePolicy;
  selection: AuthoritySelection;
  adjustments: readonly ApprovedAdjustment[];
  /** the slice's quantity unit (profile); units are never converted */
  uom: string | null;
}

interface Components {
  gross: Dec | null;
  good: Dec | null;
  reject: Dec | null;
  rework: Dec | null;
  basis: QuantityBasis;
}

/**
 * Actuals of one product slice (ACT01, ACT05–ACT07): the selected source's quantity plus approved
 * adjustments as a separate component. Basis gross: `good = gross − reject + rework_accepted` (D05;
 * rejects unknown → reject null and good = gross, flagged `rejects_not_measured`); basis good (only good
 * known): gross null, so no quality factor is ever invented. Coverage = accepted seconds ÷ window
 * (approved substitutions count when the gate says so); missing data is null, never zero.
 */
export function computeSliceActuals(input: SliceActualsInput): SliceActuals {
  const findings = [...input.selection.findings];
  const source = usableSource(input.selection.selected, input.uom, findings);
  const components = applyAdjustments(
    baseComponents(source),
    input.adjustments,
  );
  if (source && source.basis === 'gross' && source.reject === null) {
    findings.push({ code: 'rejects_not_measured', severity: 'info' });
  }
  const coverage = coverageOf(input, source);
  const main =
    components.basis === 'gross' ? components.gross : components.good;
  const split = measuredSplit(source, input.adjustments, components.basis);
  return {
    gross: fmt(components.gross),
    good: fmt(components.good),
    reject: fmt(components.reject),
    reworkAccepted: fmt(components.rework),
    uom: input.uom ?? source?.uom ?? null,
    basis: components.basis,
    method: methodOf(source, input.adjustments),
    coverageRatio: coverage.ratio,
    measuredQty: main === null ? null : formatDec(split.measured),
    estimatedQty: main === null ? null : formatDec(split.estimated),
    qualityState: qualityOf(main, coverage.ratio, findings, input),
    sourceSegments: source?.segments ?? [],
    findings: [...findings, ...(source?.findings ?? [])],
    coverage: coverage.seconds,
    adjustmentIds: input.adjustments.map((adjustment) => adjustment.id),
  };
}

/** The selected source, or null when its unit differs from the slice unit (never converted). */
function usableSource(
  selected: SourceCandidate | null,
  uom: string | null,
  findings: PeriodFinding[],
): SourceCandidate | null {
  if (!selected) return null;
  const norm = (value: string | null) =>
    value?.replace(/\s+/g, '').toLowerCase() ?? '';
  if (!uom || !selected.uom || norm(uom) === norm(selected.uom))
    return selected;
  findings.push({
    code: 'uom_mismatch',
    severity: 'problem',
    detail: { sliceUom: uom, sourceUom: selected.uom, source: selected.label },
  });
  return { ...selected, quantity: null, reject: null, observed: [] };
}

function baseComponents(source: SourceCandidate | null): Components {
  if (!source) {
    return {
      gross: null,
      good: null,
      reject: null,
      rework: null,
      basis: 'gross',
    };
  }
  if (source.basis === 'good') {
    return {
      gross: null,
      good: source.quantity,
      reject: source.reject,
      rework: null,
      basis: 'good',
    };
  }
  return {
    gross: source.quantity,
    good: null,
    reject: source.reject,
    rework: null,
    basis: 'gross',
  };
}

/** Adds approved adjustments per component, then derives good on a gross basis. */
function applyAdjustments(
  base: Components,
  adjustments: readonly ApprovedAdjustment[],
): Components {
  const sum = (kind: ApprovedAdjustment['kind']): Dec | null => {
    const rows = adjustments.filter((adjustment) => adjustment.kind === kind);
    return rows.length === 0
      ? null
      : rows.reduce((total, row) => total.plus(row.quantity), ZERO);
  };
  const plus = (a: Dec | null, b: Dec | null) =>
    a === null ? b : b === null ? a : a.plus(b);
  const gross = base.basis === 'gross' ? plus(base.gross, sum('gross')) : null;
  const reject = plus(base.reject, sum('reject'));
  const rework = sum('rework');
  const goodAdjustment = sum('good');
  const good =
    base.basis === 'good'
      ? plus(plus(base.good, goodAdjustment), rework)
      : gross === null
        ? null
        : plus(
            gross.minus(reject ?? ZERO).plus(rework ?? ZERO),
            goodAdjustment,
          );
  return { gross, good, reject, rework, basis: base.basis };
}

function coverageOf(
  input: SliceActualsInput,
  source: SourceCandidate | null,
): { ratio: string; seconds: SliceActuals['coverage'] } {
  const window = { start: input.window.from, end: input.window.to };
  const windowSeconds = (window.end.getTime() - window.start.getTime()) / 1000;
  const observed = (source?.observed ?? []).flatMap((piece) => {
    const clipped = clip(piece, window);
    return clipped ? [clipped] : [];
  });
  const substitutes = input.gate.countApprovedSubstitutionsAsAccepted
    ? input.adjustments.flatMap((adjustment) => {
        if (!adjustment.window || !isSubstitute(adjustment)) return [];
        const clipped = clip(
          { start: adjustment.window.from, end: adjustment.window.to },
          window,
        );
        return clipped ? [clipped] : [];
      })
    : [];
  const accepted = unionSeconds(union([...observed, ...substitutes]));
  const observedSeconds = unionSeconds(observed);
  return {
    ratio:
      windowSeconds > 0 ? formatDec(new Dec(accepted).div(windowSeconds)) : '0',
    seconds: {
      windowSeconds,
      observedSeconds,
      substitutedSeconds: accepted - observedSeconds,
    },
  };
}

/** Gross or good adjustments substitute missing evidence; reject / rework corrections do not. */
function isSubstitute(adjustment: ApprovedAdjustment): boolean {
  return adjustment.kind === 'gross' || adjustment.kind === 'good';
}

function measuredSplit(
  source: SourceCandidate | null,
  adjustments: readonly ApprovedAdjustment[],
  basis: QuantityBasis,
): { measured: Dec; estimated: Dec } {
  let measured = source?.quantity === null ? ZERO : (source?.measured ?? ZERO);
  let estimated =
    source?.quantity === null ? ZERO : (source?.estimated ?? ZERO);
  for (const adjustment of adjustments) {
    if (adjustment.kind !== basis) continue;
    if (adjustment.basis === 'estimated')
      estimated = estimated.plus(adjustment.quantity);
    else measured = measured.plus(adjustment.quantity);
  }
  return { measured, estimated };
}

function methodOf(
  source: SourceCandidate | null,
  adjustments: readonly ApprovedAdjustment[],
): ActualsMethod | null {
  if (source && source.quantity !== null) {
    return adjustments.length > 0 ? 'mixed' : source.method;
  }
  if (adjustments.length > 0) return 'manual';
  return source?.method ?? null;
}

function qualityOf(
  main: Dec | null,
  ratio: string,
  findings: readonly PeriodFinding[],
  input: SliceActualsInput,
): QualityState {
  const all = [...findings, ...(input.selection.selected?.findings ?? [])];
  if (all.some((finding) => finding.code === 'source_conflict'))
    return 'conflict';
  const anything =
    input.selection.selected?.available === true ||
    input.adjustments.length > 0;
  if (main === null && !anything) return 'missing';
  const problems = all.some((finding) => finding.severity === 'problem');
  if (main === null || problems || new Dec(ratio).lt(1)) return 'partial';
  if (main.isNegative()) return 'partial';
  return 'complete';
}

function fmt(value: Dec | null): string | null {
  return value === null ? null : formatDec(value);
}
