import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** `/plans/…` while `v2.planDashboard` is off for the plant (decision C4: the v1 Plan Dashboard stays). */
export function PlanDashboardOff() {
  return (
    <Alert data-testid="plan-dashboard-off">
      <AlertTitle>Period accounting is not switched on for this plant</AlertTitle>
      <AlertDescription>
        A plant manager can switch it on (feature flag “v2.planDashboard”). Until then the Plan Dashboard opens from{' '}
        <Link className="underline" to="/production-plans">
          Production Plans
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
