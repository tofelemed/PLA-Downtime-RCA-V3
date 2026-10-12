import { useOeeReport } from '@/api/v2/queries/reports';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { unitsLabel } from '../model/links';
import { SnapshotStatus } from '../components/snapshot-status';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { useDatesLabel } from '../hooks/use-dates-label';

/**
 * Reports header (§16.2 Reports, AN03): named units, the period dates, the revision selection, and of the
 * shown snapshot the generated time, approval status and — behind Details — the calculation runs.
 */
export function ReportsHeader({ scope, shownUnitIds }: { scope: AnalyticsScope; shownUnitIds: readonly string[] }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const response = query.data;
  const runIds = response?.data.calculationRunIds ?? [];
  const dates = useDatesLabel(scope, env.timezone);
  return (
    <PageHeader
      title="Reports"
      description="Approved figures of the chosen units and plant dates, with exports."
      meta={
        <div className="space-y-1" data-testid="report-snapshot" data-run-ids={[...runIds].sort().join(',')} data-unit-ids={scope.unitIds.join(',')}>
          <SnapshotStatus
            scopeLabel={`${unitsLabel(shownUnitIds, env.unitName)} · ${dates}`}
            timezone={env.timezone}
            timezoneIsFallback={env.timezoneIsFallback}
            response={response}
            isError={query.isError}
            testId="report-snapshot-details"
          />
          <Badge variant="outline">{scope.approvedOnly ? 'Approved revisions only' : 'Approved revision, else the latest draft'}</Badge>
        </div>
      }
    />
  );
}
