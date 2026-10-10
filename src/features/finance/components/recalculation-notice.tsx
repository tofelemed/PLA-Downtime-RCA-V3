import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Plan 2.6 "Decisions / risks": approvals of policies, FX rates or valuation rates do not queue a
 * recalculation; values appear when a period is next recomputed or swept.
 */
export function RecalculationNotice() {
  return (
    <Alert data-testid="recalculation-notice">
      <Info className="h-4 w-4" />
      <AlertTitle>Approving does not recalculate</AlertTitle>
      <AlertDescription>
        Approving a valuation policy, an FX rate or a valuation rate changes nothing that is already calculated. Values appear when a period is
        next recalculated (a change to it, “recalculate” on the period, or the scheduled sweep). Approved period revisions get a change proposal,
        never an overwrite.
      </AlertDescription>
    </Alert>
  );
}
