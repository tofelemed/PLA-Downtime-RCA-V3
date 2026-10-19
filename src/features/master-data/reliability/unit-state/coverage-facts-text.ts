import type { StateCoverage } from '@/api/v2/types/reliability';
import type { ReliabilityFormat } from '../shared/use-reliability-format';

/** A server ratio (0..1) as a percentage; "—" without scheduled time. */
export const ratio = (value: number | null, format: ReliabilityFormat) => (value === null ? '—' : format.percent(value * 100, 1));

/**
 * The availability as the data allows it (QA re-test N7): one value when the bounds agree (no unknown
 * time), else "between lower and upper" with the Provisional badge.
 */
export function availabilityText(coverage: Pick<StateCoverage, 'availabilityLower' | 'availabilityUpper'>, format: ReliabilityFormat): { text: string; bounded: boolean } {
  const lower = ratio(coverage.availabilityLower, format);
  const upper = ratio(coverage.availabilityUpper, format);
  return lower === upper ? { text: lower, bounded: false } : { text: `between ${lower} and ${upper}`, bounded: true };
}

/** A duration, or "none" for zero (QA re-test N7: never "0 s"). */
export const durationOrNone = (seconds: number, format: ReliabilityFormat): string => (seconds === 0 ? 'none' : format.duration(seconds));
