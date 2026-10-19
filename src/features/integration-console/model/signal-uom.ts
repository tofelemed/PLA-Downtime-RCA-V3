import type { SignalView } from '@/api/v2/types/integration-mappings';
import { labelOf, SIGNAL_TIMEBASE_LABELS } from '@/features/ux-kit/labels';

/**
 * The unit of measure a signal shows: a rate with its time base ("t per hour"); a counter (totalizer),
 * a level or a state with its unit alone ("t"), even when a time base is stored for it (QA M5).
 */
export function signalUomText(signal: Pick<SignalView, 'canonicalUom' | 'rateTimebase' | 'semanticType'>): string {
  const uom = signal.canonicalUom ?? '—';
  if (signal.semanticType !== 'rate' || !signal.rateTimebase) return uom;
  return `${uom} ${labelOf(SIGNAL_TIMEBASE_LABELS, signal.rateTimebase)}`;
}
