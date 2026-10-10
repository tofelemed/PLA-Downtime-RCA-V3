import { Dec, formatDec } from '../actuals/decimal';

export const BASELINE_METRICS = ['recurrences', 'downtime_seconds'] as const;
export type BaselineMetric = (typeof BASELINE_METRICS)[number];

/** The declared (or history-computed) baseline of an action: a metric over a window of days. */
export interface ActionBaseline {
  metric: BaselineMetric;
  windowDays: number;
  /** decimal string */
  value: string;
  /** true when a person declared the value, false when the server counted it from history */
  declared: boolean;
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
