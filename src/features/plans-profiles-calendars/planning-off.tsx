import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** `/planning` while `v2.plansProfilesCalendars` is off for the plant (decision C4: v1 screens stay the default). */
export function PlanningOff() {
  return (
    <Alert data-testid="planning-off">
      <AlertTitle>Plans, profiles & calendars (v2) is not switched on for this plant</AlertTitle>
      <AlertDescription>
        A plant manager can switch it on (feature flag “v2.plansProfilesCalendars”). Plans stay available in Production Plans, units and products in
        Master Data.
      </AlertDescription>
    </Alert>
  );
}
