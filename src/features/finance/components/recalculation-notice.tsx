import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusIcon } from '@/lib/icons';

/**
 * Plan 2.6 "Decisions / risks": approvals of policies, FX rates or valuation rates do not queue a
 * recalculation; values appear when a period is next recomputed or swept. Said once, on the page.
 */
export function RecalculationNotice() {
  return (
    <Alert data-testid="recalculation-notice">
      <StatusIcon.info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Approving does not recalculate</AlertTitle>
      <AlertDescription>
        Values already calculated stay as they are. New values appear when a period is next recalculated; approved periods get a change
        proposal, never an overwrite.
      </AlertDescription>
    </Alert>
  );
}
