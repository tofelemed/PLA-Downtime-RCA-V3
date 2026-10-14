import type { RevaluationRequested } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';

/**
 * SME V7: what an approval queued, in the server's words — the periods it values are recalculated on the
 * worker; approved periods get a change proposal, never an overwrite. Nothing is computed here.
 */
export function RevaluationQueued({ revaluation }: { revaluation: RevaluationRequested | null | undefined }) {
  const dates = usePlantDates();
  if (!revaluation) return null;
  return (
    <p className="text-sm text-muted-foreground" role="status" data-testid="revaluation-queued">
      Revaluation queued for every unit, {dates.validity(revaluation.from, revaluation.to)}. Approved periods receive a change proposal to review.
    </p>
  );
}
