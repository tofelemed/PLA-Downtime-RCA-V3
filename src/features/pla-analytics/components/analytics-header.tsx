import { Link } from 'react-router-dom';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { exportBlockedReason, exportRequestOf, scopeToParams, waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';
import { unitsLabel } from '../model/links';
import { ScopeExport } from './scope-export';
import { SnapshotStatus } from './snapshot-status';

/**
 * Title, the page status said once and the export of the shown scope (T24): the header reads the same
 * scope-waterfall response as the Waterfall view (one cached request), and the export request carries the
 * same window and units, so the page, its totals and the file name the same calculation runs.
 */
export function AnalyticsHeader({ scope, title = 'Production loss analysis', description = 'Where production was lost and why, from the calculated periods of the chosen units and window.', overview = true }: { scope: AnalyticsScope; title?: string; description?: string; overview?: boolean }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(overview ? waterfallQuery(scope) : null, env.timezone);
  return (
    <PageHeader
      title={title}
      description={description}
      actions={<HeaderActions scope={scope} overview={overview} query={query} />}
      meta={<HeaderMetadata scope={scope} overview={overview} query={query} />}
    />
  );
}

interface HeaderDetailsProps { scope: AnalyticsScope; overview: boolean; query: ReturnType<typeof useScopeWaterfall>; }

function HeaderActions({ scope, overview, query }: HeaderDetailsProps) {
  const env = useEventHubEnv();
  const { canViewMoney } = useCapabilities();
  // QA PLA Q1 / owner 19 Oct 2026: no Reports link and no value export for roles without money (operators)
  if (!canViewMoney) return null;
  if (!overview) return <Link className="text-sm font-medium text-primary underline" to={`/reports?${scopeToParams(scope)}&view=exports`}>Reports & exports</Link>;
  const provisional = query.data?.isProvisional ?? true;
  return <ScopeExport request={exportRequestOf(scope, 'period_summary', provisional)} disabledReason={exportBlockedReason(scope, provisional, 'Approved only')} label="Export period summary" timezone={env.timezone} />;
}

function HeaderMetadata({ scope, overview, query }: HeaderDetailsProps) {
  const env = useEventHubEnv();
  const label = `${unitsLabel(scope.unitIds, env.unitName)} · ${scope.windowLabel}`;
  return <div className="space-y-1">
    {overview ? <SnapshotStatus scopeLabel={label} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback}
      uom={query.data?.data.uom ?? null} baseline={scope.ledger === 'plan' ? 'approved plan (plan ledger)' : 'sustained rate (capacity ledger)'} response={query.data} isError={query.isError} approvedOnly={scope.approvedOnly} />
      : <ScopeHeader scopeLabel={label} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} />}
    <p className="text-xs">Periods are grouped by the plant’s operational date and shift; several sites are compared on their own local days.</p>
  </div>;
}
