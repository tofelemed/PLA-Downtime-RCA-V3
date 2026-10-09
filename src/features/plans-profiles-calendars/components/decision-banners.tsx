import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Open owner decisions that change what these screens mean (plan 3.4 "Decisions / risks"): shown until
 * they are recorded in plans/DECISIONS.md. D03 is recorded (Asia/Tehran, 06:00, 3 × 8 h); the calendar
 * itself is configuration created here — nothing is seeded.
 */
export function DecisionBanners({ tab }: { tab: string }) {
  if (tab === 'profiles') {
    return (
      <Alert data-testid="decision-banner" data-decision="D08">
        <Info className="h-4 w-4" />
        <AlertTitle>Valuation (D08) partly open</AlertTitle>
        <AlertDescription>
          Rates are entered in IRR or USD. Nothing is valued until finance approves a valuation policy (shown as “unvalued (policy pending)”), and
          the v1 product standard rate stays an unconfirmed legacy cost (D08 Q3). Plans need explicit approved rates — there is no default rate.
        </AlertDescription>
      </Alert>
    );
  }
  if (tab === 'calendars') {
    return (
      <Alert data-testid="decision-banner" data-decision="D03">
        <Info className="h-4 w-4" />
        <AlertTitle>Plant calendar (D03)</AlertTitle>
        <AlertDescription>
          Recorded: Asia/Tehran, operational day 06:00, three 8-hour shifts, holidays excluded. Create and publish it here; the “reduced” holiday
          treatment has no reduction rule yet and is only warned about.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
