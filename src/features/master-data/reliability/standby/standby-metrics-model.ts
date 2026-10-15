import type { Fraction, StandbyEvaluation, StandbyMetricsView, StandbyOutcome, StandbyRecordKind } from '@/api/v2/types/reliability';

/** Display formatters of the plant (digits setting); the values themselves come from the server. */
export interface MetricFormat {
  number: (value: number) => string;
  /** a percentage already scaled to 0..100 */
  percent: (value: number, fractionDigits: number) => string;
  duration: (seconds: number) => string;
}

export const EVALUATION_LABELS: Readonly<Record<StandbyEvaluation, string>> = {
  demand: 'On demand (failed starts per demand)',
  running: 'On running (operating MTBF)',
  demand_and_running: 'On demand and on running',
};

export const RECORD_KIND_LABELS: Readonly<Record<StandbyRecordKind, string>> = {
  demand: 'Start demand',
  test: 'Proof test',
  run: 'Running period',
};

export const OUTCOME_LABELS: Readonly<Record<StandbyOutcome, string>> = {
  success: 'Success',
  failed_start: 'Failed to start',
  failed_while_running: 'Failed while running',
};

const NO_VALUE: Readonly<Record<string, string>> = {
  no_demands: 'No start demands',
  no_tests: 'No tests',
  no_running_exposure: 'No running time',
};

/** `5 % (1 of 20)`; without a denominator the server's reason in words. */
export function fractionText(fraction: Fraction, format: MetricFormat): string {
  if (fraction.value === null) return NO_VALUE[fraction.reason ?? ''] ?? 'Not computable';
  return `${format.percent(fraction.value * 100, 1)} (${format.number(fraction.numerator)} of ${format.number(fraction.denominator)})`;
}

/**
 * Operating MTBF as the server gives it: running time per failure while running. With running time and no
 * failure it is never "infinite": "No failures — exposure 50 h" names the evidence instead.
 */
export function mtbfText(metrics: StandbyMetricsView, format: MetricFormat): string {
  const mtbf = metrics.operatingMtbf;
  if (mtbf.value !== null) return format.duration(mtbf.value);
  if (mtbf.reason === 'no_failures') return `No failures — exposure ${format.duration(metrics.runningSeconds)}`;
  return NO_VALUE[mtbf.reason ?? ''] ?? 'Not computable';
}
