import { Dec, formatDec } from '../actuals/decimal';
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
  /** decimal string, run seconds of the unit in the window */
  exposureSeconds: string;
}

/** Acceptance criteria frozen into the action when its verification is planned (CA2: set before). */
export interface EffectivenessCriteria {
  requiredReduction: number;
  minExposureHours: number;
  /** high-consequence mode: any repeat in the window is not effective */
  zeroRepeat: boolean;
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

function verdictOf(
  result: Omit<EffectivenessResult, 'verdict' | 'reasons'>,
  input: {
    post: ExposureWindow;
    criteria: EffectivenessCriteria;
    baselineValue: Dec;
  },
): { verdict: EffectivenessVerdict; reasons: string[] } {
  const postHours = new Dec(input.post.exposureSeconds).div(HOUR);
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
 * (the approved correction when there is one, CA3). Insufficient evidence below the frozen minimum
 * exposure or without history; not effective when a high-consequence mode repeats or the reduction is
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
