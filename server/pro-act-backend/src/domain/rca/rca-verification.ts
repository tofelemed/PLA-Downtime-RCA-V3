import { Dec, formatDec } from '../actuals/decimal';
import { EffectivenessCriteria, ExposureWindow } from './effectiveness';
import { RepeatMatch } from './rca-policy';

export const BASELINE_METRICS = ['recurrences', 'downtime_seconds'] as const;
export type BaselineMetric = (typeof BASELINE_METRICS)[number];

/** CA3 correction of a computed baseline: proposed with a reason, decided by someone else. */
export interface BaselineCorrection {
  /** corrected metric value over the same exposure (decimal string) */
  value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedBy: string | null;
  proposedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
}

/**
 * The baseline of an action: a metric over a window of days. Since CA3 it is computed by the server from
 * history (same assets and failure mode, run-time exposure), frozen with its query version, criteria and
 * window; a person can only propose a correction that another person approves. `declared` rows were typed
 * before CA3 and are kept as they were.
 */
export interface ActionBaseline {
  metric: BaselineMetric;
  windowDays: number;
  /** decimal string: the counted metric over the window */
  value: string;
  /** true when a person declared the value (before CA3), false when the server counted it */
  declared: boolean;
  /** CA3: the frozen history window with its run-time exposure (absent on rows before CA3) */
  window?: ExposureWindow;
  match?: RepeatMatch;
  modeKeys?: string[];
  queryVersion?: string;
  computedAt?: string;
  /** CA2: acceptance criteria frozen when the verification was planned */
  criteria?: EffectivenessCriteria;
  correction?: BaselineCorrection | null;
}

/** The approved corrected value, else null (a pending or rejected proposal never counts). */
export function approvedCorrection(baseline: ActionBaseline): string | null {
  return baseline.correction?.status === 'approved'
    ? baseline.correction.value
    : null;
}

/** What the verification job observed in the action's verification window. */
export interface PostActionObservation {
  windowDays: number;
  recurrences: number;
  /** decimal string, seconds */
  observedLossSeconds: string;
}

export interface RealizedResult {
  metric: BaselineMetric;
  /** the baseline scaled to the verification window length (decimal string) */
  expected: string;
  /** the observed value of the metric in the verification window (decimal string) */
  observed: string;
  /** expected − observed: positive = fewer recurrences / less loss than the baseline (decimal string) */
  difference: string;
}

/** Whole days of a half-open window, at least a fraction of a day (never zero). */
export function windowDays(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (!(days > 0)) throw new RangeError('the window must end after it starts');
  return days;
}

/**
 * RCA03 realized difference: the baseline rate over the verification window minus what was observed.
 * Kept apart from the person's claimed avoided loss and from the approved historical loss of the ledger;
 * the three are never added or netted.
 */
export function realizedDifference(
  baseline: ActionBaseline,
  post: PostActionObservation,
): RealizedResult {
  const scale = new Dec(post.windowDays).div(new Dec(baseline.windowDays));
  const expected = new Dec(baseline.value).mul(scale);
  const observed =
    baseline.metric === 'recurrences'
      ? new Dec(post.recurrences)
      : new Dec(post.observedLossSeconds);
  return {
    metric: baseline.metric,
    expected: formatDec(expected),
    observed: formatDec(observed),
    difference: formatDec(expected.minus(observed)),
  };
}
