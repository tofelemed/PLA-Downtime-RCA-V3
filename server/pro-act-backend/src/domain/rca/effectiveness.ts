import { Dec, formatDec } from '../actuals/decimal';
import { ExposureBasis } from './exposure-basis';
import { DEFAULT_MINIMUM_COVERAGE } from './rca-policy-rules';
import { BaselineMetric } from './rca-verification';

export const EFFECTIVENESS_VERDICTS = [
  'effective',
  'not_effective',
  'insufficient_evidence',
] as const;
export type EffectivenessVerdict = (typeof EFFECTIVENESS_VERDICTS)[number];

/** Same-mode unplanned incidents of a window and its run time (planned and unplanned downtime excluded). */
export interface ExposureWindow {
  from: string;
  to: string;
  incidents: number;
  /** decimal string, seconds of the incidents clipped to the window */
  downtimeSeconds: string;
  /** decimal string, run seconds in the window (of the unit, or of the standby assets: `exposureBasis`) */
  exposureSeconds: string;
  /** absent on windows computed before rca-exposure-v2 (unit run time) */
  exposureBasis?: ExposureBasis;
  /** rca-exposure-v3, unit run time: seconds of known unit state (running or stopped) in the window */
  knownSeconds?: string;
  /** rca-exposure-v3, unit run time: seconds without known state (no data, stale, bad quality, unmapped) */
  unknownSeconds?: string;
  /** rca-exposure-v3, unit run time: known / window (decimal string 0–1); null for an empty window */
  coverage?: string | null;
  /** case units without any state mapping version overlapping the window (absent on earlier windows) */
  unmappedUnitIds?: string[];
}

/** Acceptance criteria frozen into the action when its verification is planned (CA2: set before). */
export interface EffectivenessCriteria {
  requiredReduction: number;
  minExposureHours: number;
  /** high-consequence mode: any repeat in the window is not effective */
  zeroRepeat: boolean;
  /** state-data coverage (0–1) the post-action window needs; absent (frozen before 18 Oct 2026) = 0.95 */
  minimumCoverage?: number;
}

/** The known-data coverage both windows reported and the minimum the verdict applied (decimal strings). */
export interface EffectivenessCoverage {
  /** null for windows counted before rca-exposure-v3 or on the standby basis */
  baseline: string | null;
  post: string | null;
  minimum: string;
}

export interface EffectivenessResult {
  verdict: EffectivenessVerdict;
  /** per 1,000 run hours (decimal strings); null when the exposure is zero */
  baselineRate: string | null;
  postRate: string | null;
  /** 1 − post / baseline (decimal string); null when not computable */
  reduction: string | null;
  /** zero repeats: approximate 95 % lower MTBF bound, exposure / 2.996 (constant rate); else null */
  mtbfLowerBound95Hours: string | null;
  reasons: string[];
  /** owner, 18 Oct 2026: the coverage of both windows and the minimum (absent on verdicts stored before) */
  coverage?: EffectivenessCoverage;
}

const HOUR = 3600;
const PER = 1000;
/** −ln(0.05): zero-failure 95 % lower confidence bound factor (NIST handbook 8.4.5.1) */
const ZERO_FAILURE_95 = '2.996';

const metricValue = (window: ExposureWindow, metric: BaselineMetric): Dec =>
  metric === 'recurrences'
    ? new Dec(window.incidents)
    : new Dec(window.downtimeSeconds);

/** Metric per 1,000 run hours; null without exposure. */
export function ratePer1000Hours(value: Dec, exposureSeconds: Dec): Dec | null {
  if (!exposureSeconds.gt(0)) return null;
  return value.div(exposureSeconds.div(HOUR)).mul(PER);
}

const pct = (share: Dec): string =>
  formatDec(share.mul(100).toDecimalPlaces(1));

/** Gated windows: unit run time counted from state data (rca-exposure-v3); standby / earlier are not. */
const gated = (window: ExposureWindow): boolean =>
  window.exposureBasis !== 'standby_running_time' &&
  window.coverage !== undefined &&
  window.coverage !== null;

/** Owner, 18 Oct 2026: a unit without a state mapping has no known run time; it needs a mapping first. */
export function mappingGap(window: ExposureWindow): string | null {
  if (window.exposureBasis === 'standby_running_time') return null;
  const count = window.unmappedUnitIds?.length ?? 0;
  if (count === 0) return null;
  return count === 1
    ? 'needs a state mapping for this unit'
    : `needs a state mapping for each of these ${count} units`;
}

/**
 * SME D2 / CA2, owner 18 Oct 2026: a verdict needs the state data to cover at least the frozen minimum of
 * the window after the action (`minimumCoverage`, 0.95 when frozen before the field) — a repeat during a
 * data gap would go unseen, so unknown time is never read as a run without failures. Windows computed
 * before rca-exposure-v3 (and the standby basis) carry no coverage and are not gated.
 */
export function coverageGap(
  window: ExposureWindow,
  minimumCoverage: number = DEFAULT_MINIMUM_COVERAGE,
): string | null {
  if (!gated(window)) return null;
  const coverage = new Dec(window.coverage ?? '0');
  const minimum = new Dec(minimumCoverage);
  if (coverage.gte(minimum)) return null;
  const unknownHours = new Dec(window.unknownSeconds ?? '0').div(HOUR);
  return `state data covers ${pct(coverage)} % of the window after the action (${formatDec(unknownHours.toDecimalPlaces(1))} h without data); a verdict needs at least ${pct(minimum)} % coverage`;
}

function coverageOf(
  baseline: ExposureWindow,
  post: ExposureWindow,
  minimumCoverage: number,
): EffectivenessCoverage {
  return {
    baseline: gated(baseline) ? (baseline.coverage ?? null) : null,
    post: gated(post) ? (post.coverage ?? null) : null,
    minimum: formatDec(new Dec(minimumCoverage)),
  };
}

function verdictOf(
  result: Omit<EffectivenessResult, 'verdict' | 'reasons'>,
  input: {
    post: ExposureWindow;
    criteria: EffectivenessCriteria;
    baselineValue: Dec;
  },
): { verdict: EffectivenessVerdict; reasons: string[] } {
  const postHours = new Dec(input.post.exposureSeconds).div(HOUR);
  const gap =
    mappingGap(input.post) ??
    coverageGap(
      input.post,
      input.criteria.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE,
    );
  if (gap) return { verdict: 'insufficient_evidence', reasons: [gap] };
  if (postHours.lt(input.criteria.minExposureHours)) {
    return {
      verdict: 'insufficient_evidence',
      reasons: [
        `needs ${input.criteria.minExposureHours} run hours after the action, has ${formatDec(postHours.toDecimalPlaces(1))}`,
      ],
    };
  }
  if (input.criteria.zeroRepeat && input.post.incidents > 0) {
    return {
      verdict: 'not_effective',
      reasons: ['a high-consequence mode repeated after the action'],
    };
  }
  if (result.baselineRate === null || !input.baselineValue.gt(0)) {
    return input.post.incidents > 0
      ? {
          verdict: 'not_effective',
          reasons: ['the mode occurred after the action and not before'],
        }
      : {
          verdict: 'insufficient_evidence',
          reasons: ['no same-mode history before the action to improve on'],
        };
  }
  const reduction = new Dec(result.reduction ?? '0');
  return reduction.gte(input.criteria.requiredReduction)
    ? {
        verdict: 'effective',
        reasons: [
          `rate reduced by ${formatDec(reduction.mul(100).toDecimalPlaces(1))} %`,
        ],
      }
    : {
        verdict: 'not_effective',
        reasons: [
          `rate reduced by ${formatDec(reduction.mul(100).toDecimalPlaces(1))} %, ${input.criteria.requiredReduction * 100} % required`,
        ],
      };
}

/**
 * CA2 verdict of an action: the same-mode rate per run hour after the action against the baseline rate
 * (the approved correction when there is one, CA3). Insufficient evidence for a unit without a state
 * mapping, below the frozen minimum coverage or exposure, or without history; not effective when a high-consequence mode repeats or the reduction is
 * below the frozen target; effective otherwise. Zero repeats give a 95 % lower MTBF bound, never "infinite".
 */
export function effectivenessOf(input: {
  metric: BaselineMetric;
  baseline: ExposureWindow;
  /** approved corrected baseline value (incidents or seconds over the same exposure), else null */
  correctedBaseline: string | null;
  post: ExposureWindow;
  criteria: EffectivenessCriteria;
}): EffectivenessResult {
  const baselineValue = input.correctedBaseline
    ? new Dec(input.correctedBaseline)
    : metricValue(input.baseline, input.metric);
  const baselineRate = ratePer1000Hours(
    baselineValue,
    new Dec(input.baseline.exposureSeconds),
  );
  const postExposure = new Dec(input.post.exposureSeconds);
  const postRate = ratePer1000Hours(
    metricValue(input.post, input.metric),
    postExposure,
  );
  const reduction =
    baselineRate && postRate && baselineRate.gt(0)
      ? new Dec(1).minus(postRate.div(baselineRate))
      : null;
  const partial = {
    baselineRate: baselineRate
      ? formatDec(baselineRate.toDecimalPlaces(4))
      : null,
    postRate: postRate ? formatDec(postRate.toDecimalPlaces(4)) : null,
    reduction: reduction ? formatDec(reduction.toDecimalPlaces(4)) : null,
    mtbfLowerBound95Hours:
      input.post.incidents === 0 && postExposure.gt(0)
        ? formatDec(
            postExposure.div(HOUR).div(ZERO_FAILURE_95).toDecimalPlaces(1),
          )
        : null,
  };
  return {
    ...partial,
    ...verdictOf(partial, {
      post: input.post,
      criteria: input.criteria,
      baselineValue,
    }),
    coverage: coverageOf(
      input.baseline,
      input.post,
      input.criteria.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE,
    ),
  };
}

/**
 * The case's effectiveness from its verified actions: none verified = null (not verified yet); any not
 * effective = not effective; any insufficient = insufficient evidence; all effective = effective.
 */
export function caseEffectiveness(
  verdicts: ReadonlyArray<EffectivenessVerdict>,
): EffectivenessVerdict | null {
  if (verdicts.length === 0) return null;
  if (verdicts.includes('not_effective')) return 'not_effective';
  if (verdicts.includes('insufficient_evidence'))
    return 'insufficient_evidence';
  return 'effective';
}
