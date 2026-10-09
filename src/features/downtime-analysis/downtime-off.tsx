import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** `/downtime` while `v2.downtimeAnalysis` is off for the plant (decision C4: v1 screens stay the default). */
export function DowntimeAnalysisOff() {
  return (
    <Alert data-testid="downtime-analysis-off">
      <AlertTitle>Downtime Analysis is not switched on for this plant</AlertTitle>
      <AlertDescription>A plant manager can switch it on (feature flag “v2.downtimeAnalysis”). Downtime figures are also in Reports and PLA Analytics.</AlertDescription>
    </Alert>
  );
}
