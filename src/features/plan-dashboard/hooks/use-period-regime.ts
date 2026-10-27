import { useLossAccountingMode } from '@/features/accounting-mode/use-loss-accounting-mode';
import { periodRegime, type PeriodRegime, type RegimeFacts } from '../model/period-regime';

/** The regime of a period or day view (its own run's basis and grain); the unit's policy in force only before its first run. */
export function usePeriodRegime(view: RegimeFacts & { unitId: string }): PeriodRegime {
  const inForce = useLossAccountingMode(view.unitId);
  return periodRegime(view, inForce);
}
