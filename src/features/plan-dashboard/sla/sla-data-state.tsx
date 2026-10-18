import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import { labelOf } from '@/features/ux-kit/labels';
import { ACTUALS_QUALITY_LABELS } from '../model/actuals-labels';

/**
 * The data side of the SLA line, from the server's actuals quality of the period's products ("Data complete"
 * when every product's actuals are complete). Nothing while a hold is open: the "Waiting for data" badge says it.
 */
export function SlaDataState({ periodId, onHold }: { periodId: string; onHold: boolean }) {
  const slices = useProductionPeriod(periodId).data?.data.slices;
  if (onHold || !slices || slices.length === 0) return null;
  const states = [...new Set(slices.map((s) => s.actuals?.qualityState ?? 'missing'))];
  const complete = states.length === 1 && states[0] === 'complete';
  return (
    <span className="text-muted-foreground" data-testid="sla-data-state" data-state={complete ? 'complete' : 'incomplete'}>
      {complete ? 'Data complete' : `Data: ${states.map((s) => labelOf(ACTUALS_QUALITY_LABELS, s).toLowerCase()).join(', ')}`}
    </span>
  );
}
