import { useOeeReport } from '@/api/v2/queries/reports';
import { Badge } from '@/components/ui/badge';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';

/**
 * Reports header (§16.2 Reports, AN03): named units, the period dates, the revision selection, and of the
 * shown snapshot the generated time, approval status and calculation runs.
 */
export function ReportsHeader({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const response = query.data;
  const runIds = response?.data.calculationRunIds ?? [];
  const units = scope.unitIds.length === 0 ? 'All units in your scope' : scope.unitIds.map(env.unitName).join(', ');
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ScopeHeader scopeLabel={`${units} · ${scope.windowLabel}`} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} isProvisional={response?.isProvisional} asOf={response?.asOf ?? null} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="report-snapshot" data-run-ids={[...runIds].sort().join(',')} data-unit-ids={scope.unitIds.join(',')}>
        <Badge variant="outline">{scope.approvedOnly ? 'Approved revisions only' : 'Approved revision, else the latest draft'}</Badge>
        {response && (
          <>
            <span>
              Generated <PlantTime iso={response.asOf} tz={env.timezone} withDate />
            </span>
            <span>{runIds.length} calculation runs</span>
            <span>{response.dataQuality.provisionalCount} provisional · {response.dataQuality.missingCount} not calculated</span>
          </>
        )}
      </div>
    </header>
  );
}
