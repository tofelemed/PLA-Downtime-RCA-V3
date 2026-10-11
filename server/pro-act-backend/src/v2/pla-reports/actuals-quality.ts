import { Dec, formatDec, toDec, ZERO } from '../../domain/actuals/decimal';
import { ActualsResult } from '../../periods/entities/actuals-result.entity';
import { PeriodState } from '../period-overview/period-states';

/** Coverage bands of a slice's actuals (share of the period window backed by measured data). */
export const COVERAGE_BANDS = [
  { key: 'full', label: '100 %', min: '1' },
  { key: 'high', label: '90–99 %', min: '0.9' },
  { key: 'partial', label: '50–89 %', min: '0.5' },
  { key: 'low', label: 'Under 50 %', min: '0' },
] as const;

export interface ActualsQualityView {
  /** periods of the scope */
  periods: number;
  /** product slices with an actuals result behind the shown runs */
  slices: number;
  /** periods without any actuals result (no shown run, or a run without actuals) */
  periodsWithoutActuals: number;
  /** actuals quality state of the slices (complete, partial, missing, conflict) */
  qualityStates: Array<{ state: string; slices: number }>;
  /** coverage band of the slices; `unknown` = no coverage ratio recorded */
  coverage: Array<{ key: string; label: string; slices: number }>;
  /** lowest coverage ratio of any slice (decimal string 0..1), null without actuals */
  lowestCoverage: string | null;
  /** measured and estimated output per unit of measure (never summed across units) */
  quantities: Array<{
    uom: string | null;
    measured: string;
    estimated: string;
  }>;
  calculationRunIds: string[];
}

const QUALITY_STATES = ['complete', 'partial', 'missing', 'conflict'];

function bandOf(ratio: Dec | null): string {
  if (ratio === null) return 'unknown';
  const band = COVERAGE_BANDS.find((b) => ratio.gte(b.min));
  return band?.key ?? 'low';
}

/** Running counts of an actuals quality report; fed page by page (`addQualityStates`), read by `qualityView`. */
export interface QualityAccumulator {
  periods: number;
  periodsWithoutActuals: number;
  slices: number;
  states: Map<string, number>;
  bands: Map<string, number>;
  lowest: Dec | null;
  quantities: Map<string, { measured: Dec; estimated: Dec }>;
  runIds: Set<string>;
}

export const qualityAccumulator = (): QualityAccumulator => ({
  periods: 0,
  periodsWithoutActuals: 0,
  slices: 0,
  states: new Map(),
  bands: new Map(),
  lowest: null,
  quantities: new Map(),
  runIds: new Set(),
});

const bump = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);

function addResult(acc: QualityAccumulator, result: ActualsResult): void {
  const ratio = toDec(result.coverageRatio);
  acc.slices += 1;
  bump(acc.states, result.qualityState);
  bump(acc.bands, bandOf(ratio));
  if (ratio !== null && (acc.lowest === null || ratio.lt(acc.lowest)))
    acc.lowest = ratio;
  const key = result.uom ?? '';
  const sum = acc.quantities.get(key) ?? { measured: ZERO, estimated: ZERO };
  sum.measured = sum.measured.plus(toDec(result.measuredQty) ?? ZERO);
  sum.estimated = sum.estimated.plus(toDec(result.estimatedQty) ?? ZERO);
  acc.quantities.set(key, sum);
}

export function addQualityStates(
  acc: QualityAccumulator,
  states: readonly PeriodState[],
): void {
  for (const state of states) {
    acc.periods += 1;
    if (state.run) acc.runIds.add(state.run.id);
    if (state.actuals.length === 0) acc.periodsWithoutActuals += 1;
    for (const result of state.actuals) addResult(acc, result);
  }
}

/**
 * Actuals quality coverage of a scope (plan 3.6, AN02): the stored actuals results behind the shown runs —
 * quality state and coverage band per product slice, the lowest coverage, measured vs estimated output per
 * unit of measure. Counts and sums only; nothing is estimated here.
 */
export function qualityView(acc: QualityAccumulator): ActualsQualityView {
  const extraStates = [...acc.states.keys()].filter(
    (s) => !QUALITY_STATES.includes(s),
  );
  return {
    periods: acc.periods,
    slices: acc.slices,
    periodsWithoutActuals: acc.periodsWithoutActuals,
    qualityStates: [...QUALITY_STATES, ...extraStates.sort()].map((state) => ({
      state,
      slices: acc.states.get(state) ?? 0,
    })),
    coverage: [
      ...COVERAGE_BANDS,
      { key: 'unknown', label: 'Not recorded' },
    ].map((b) => ({
      key: b.key,
      label: b.label,
      slices: acc.bands.get(b.key) ?? 0,
    })),
    lowestCoverage: acc.lowest ? formatDec(acc.lowest) : null,
    quantities: [...acc.quantities.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([uom, sum]) => ({
        uom: uom === '' ? null : uom,
        measured: formatDec(sum.measured),
        estimated: formatDec(sum.estimated),
      })),
    calculationRunIds: [...acc.runIds].sort(),
  };
}
