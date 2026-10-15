import { AnalogThresholds } from '../../domain/reliability/analog-state';
import { invalidField } from '../master-data/common/master-data-errors';
import { AnalogThresholdsDto } from './unit-state-v2.dto';

/** Signal types an analog mapping may band (a state signal may carry numbers too). */
export const ANALOG_SIGNAL_TYPES: ReadonlySet<string> = new Set([
  'state',
  'rate',
  'level',
  'other',
]);

/**
 * Plan 1.10 analog thresholds of a mapping body, normalised (hysteresis 0, stop state internal stop by
 * default); 422 INVALID_FIELD when the reduced-rate threshold is not above the stop threshold or the rated
 * value not above zero. Null = no analog mapping.
 */
export function thresholdsOf(
  input: AnalogThresholdsDto | null | undefined,
): AnalogThresholds | null {
  if (!input) return null;
  const reducedBelow = input.reducedBelow ?? null;
  const ratedValue = input.ratedValue ?? null;
  if (reducedBelow !== null && reducedBelow <= input.stopBelow) {
    throw invalidField(
      'thresholds.reducedBelow',
      'the reduced-rate threshold must be above the stop threshold',
    );
  }
  if (ratedValue !== null && ratedValue <= 0) {
    throw invalidField(
      'thresholds.ratedValue',
      'the rated value must be above 0',
    );
  }
  return {
    stopBelow: input.stopBelow,
    reducedBelow,
    hysteresis: input.hysteresis ?? 0,
    stopState: input.stopState ?? 'internal_stop',
    ratedValue,
  };
}
