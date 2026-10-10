import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { exportRequestOf, waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';
import { ScopeExport } from './scope-export';

/**
 * Title, the UX03 status line and the export of the shown scope (T24): the header reads the same
 * scope-waterfall response as the Waterfall tab (one cached request), and the export request carries the
 * same window and units, so the page, its totals and the file name the same calculation runs.
 */
export function AnalyticsHeader({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(waterfallQuery(scope), env.timezone);
  const response = query.data;
  const units = scope.unitIds.length === 0 ? 'All units in your scope' : scope.unitIds.map(env.unitName).join(', ');
  const runIds = response?.data.calculationRunIds ?? [];
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">PLA Analytics</h1>
        <ScopeHeader
          scopeLabel={`${units} · ${scope.windowLabel}`}
          timezone={env.timezone}
          timezoneIsFallback={env.timezoneIsFallback}
          uom={response?.data.uom ?? null}
          baseline={scope.ledger === 'plan' ? 'approved plan (plan ledger)' : 'sustained rate (capacity ledger)'}
          isProvisional={response?.isProvisional}
          asOf={response?.asOf ?? null}
        />
        <p className="text-xs text-muted-foreground" data-testid="snapshot-runs" data-run-ids={[...runIds].sort().join(',')}>
          {response
            ? `${runIds.length} calculation runs · policy ${response.policyVersion ?? 'not recorded'} · ${formatRatio(String(response.coverage.ratio), 0)} of periods calculated`
            : query.isError
              ? 'No waterfall snapshot for this scope (see the Waterfall tab)'
              : 'Loading the snapshot…'}
        </p>
        <p className="text-xs text-muted-foreground">
          Periods are grouped by the plant’s operational date and shift ({env.timezone}); several sites are compared on their own local days.
        </p>
      </div>
      <ScopeExport request={exportRequestOf(scope, 'period_summary', response?.isProvisional ?? true)} label="Export period summary" timezone={env.timezone} />
    </header>
  );
}
