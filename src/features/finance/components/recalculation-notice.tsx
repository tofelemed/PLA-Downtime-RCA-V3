import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusIcon } from '@/lib/icons';

/**
 * SME V7 (14 Oct 2026): approving a policy, FX rate, valuation rate or demand status queues a
 * recalculation of the periods it values; approved periods get a change proposal. Said once, on the page.
 */
export function RecalculationNotice() {
  return (
    <Alert data-testid="recalculation-notice">
      <StatusIcon.info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Approving revalues the periods it covers</AlertTitle>
      <AlertDescription>
        An approval queues a recalculation of the periods its validity covers. Lost tonnes never change; open periods are revalued and approved
        periods get a change proposal to review, never an overwrite. A period without an approved rate shows its value as not valued, never zero.
      </AlertDescription>
    </Alert>
  );
}
