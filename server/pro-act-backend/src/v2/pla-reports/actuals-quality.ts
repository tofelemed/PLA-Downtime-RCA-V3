import { Dec, formatDec, toDec, ZERO } from '../../domain/actuals/decimal';
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

/**
 * Actuals quality coverage of a scope (plan 3.6, AN02): the stored actuals results behind the shown runs —
 * quality state and coverage band per product slice, the lowest coverage, measured vs estimated output per
 * unit of measure. Counts and sums only; nothing is estimated here.
 */
export function actualsQuality(
  states: readonly PeriodState[],
): ActualsQualityView {
  const results = states.flatMap((s) => s.actuals);
  const ratios = results.map((r) => toDec(r.coverageRatio));
  const known = ratios.filter((r): r is Dec => r !== null);
  const quantities = new Map<string, { measured: Dec; estimated: Dec }>();
  for (const result of results) {
    const key = result.uom ?? '';
    const sum = quantities.get(key) ?? { measured: ZERO, estimated: ZERO };
    sum.measured = sum.measured.plus(toDec(result.measuredQty) ?? ZERO);
    sum.estimated = sum.estimated.plus(toDec(result.estimatedQty) ?? ZERO);
    quantities.set(key, sum);
  }
  const extraStates = [...new Set(results.map((r) => r.qualityState))].filter(
    (s) => !QUALITY_STATES.includes(s),
  );
  return {
    periods: states.length,
    slices: results.length,
    periodsWithoutActuals: states.filter((s) => s.actuals.length === 0).length,
    qualityStates: [...QUALITY_STATES, ...extraStates.sort()].map((state) => ({
      state,
      slices: results.filter((r) => r.qualityState === state).length,
    })),
    coverage: [
      ...COVERAGE_BANDS,
      { key: 'unknown', label: 'Not recorded' },
    ].map((b) => ({
      key: b.key,
      label: b.label,
      slices: ratios.filter((r) => bandOf(r) === b.key).length,
    })),
    lowestCoverage: known.length ? formatDec(Dec.min(...known)) : null,
    quantities: [...quantities.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([uom, sum]) => ({
        uom: uom === '' ? null : uom,
        measured: formatDec(sum.measured),
        estimated: formatDec(sum.estimated),
      })),
    calculationRunIds: [
      ...new Set(states.flatMap((s) => (s.run ? [s.run.id] : []))),
    ].sort(),
  };
}
