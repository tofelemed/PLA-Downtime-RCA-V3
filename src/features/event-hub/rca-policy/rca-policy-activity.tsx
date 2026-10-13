import { useFlag } from '@/api/v2/queries/feature-flags';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * RCA-03: the server applies this policy only while the plant's `v2.rca` flag is on; otherwise the
 * legacy RCA trigger configuration decides. Says so, so nobody tunes thresholds that never fire.
 */
export function RcaPolicyActivity() {
  const flag = useFlag('v2.rca');
  if (flag.loading || flag.enabled) return null;
  return (
    <Alert role="alert" data-testid="rca-policy-inactive">
      <AlertTitle>These trigger settings are not active on this plant</AlertTitle>
      <AlertDescription>
        Events are still checked against the legacy RCA trigger configuration. These settings take over when an
        administrator switches on the plant feature flag <code>v2.rca</code>.
      </AlertDescription>
    </Alert>
  );
}
