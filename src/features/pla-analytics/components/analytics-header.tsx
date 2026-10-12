import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { exportRequestOf, waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';
import { unitsLabel } from '../model/links';
import { ScopeExport } from './scope-export';
import { SnapshotStatus } from './snapshot-status';

/**
 * Title, the page status said once and the export of the shown scope (T24): the header reads the same
 * scope-waterfall response as the Waterfall view (one cached request), and the export request carries the
 * same window and units, so the page, its totals and the file name the same calculation runs.
 */
export function AnalyticsHeader({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(waterfallQuery(scope), env.timezone);
  const response = query.data;
  return (
    <PageHeader
      title="Production loss analysis"
      description="Where production was lost and why, from the calculated periods of the chosen units and window."
      actions={<ScopeExport request={exportRequestOf(scope, 'period_summary', response?.isProvisional ?? true)} label="Export period summary" timezone={env.timezone} />}
      meta={
        <div className="space-y-1">
          <SnapshotStatus
            scopeLabel={`${unitsLabel(scope.unitIds, env.unitName)} · ${scope.windowLabel}`}
            timezone={env.timezone}
            timezoneIsFallback={env.timezoneIsFallback}
            uom={response?.data.uom ?? null}
            baseline={scope.ledger === 'plan' ? 'approved plan (plan ledger)' : 'sustained rate (capacity ledger)'}
            response={response}
            isError={query.isError}
          />
          <p className="text-xs">Periods are grouped by the plant’s operational date and shift; several sites are compared on their own local days.</p>
        </div>
      }
    />
  );
}
