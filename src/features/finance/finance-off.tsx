import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** `/finance` while `v2.codesAdmin` (the v2 admin flag) is off for the plant: there is no v1 finance screen. */
export function FinanceOff() {
  return (
    <Alert data-testid="finance-off">
      <AlertTitle>Finance (v2) is not switched on for this plant</AlertTitle>
      <AlertDescription>
        Valuation policy and FX rates are part of the v2 administration screens. A manager can switch them on with the “v2.codesAdmin” feature flag.
      </AlertDescription>
    </Alert>
  );
}
