import { Link } from 'react-router-dom';
import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { exportBlockedReason, exportRequestOf, scopeToParams, waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';
import { ScopeExport } from './scope-export';
import { SnapshotStatus } from './snapshot-status';

/**
 * Title and the export of the shown scope (T24); on the overview the incomplete-data note and the runs behind
 * "Details", read from the same scope-waterfall response as the Waterfall view (one cached request), so the
 * page, its totals and the file name the same calculation runs. No description, scope line or timezone badge
 * (cleanup 24 Oct 2026): the filter bar and the app header show them; "Provisional" is on the card.
 */
export function AnalyticsHeader({ scope, title = 'Production loss analysis', overview = true }: { scope: AnalyticsScope; title?: string; overview?: boolean }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(overview ? waterfallQuery(scope) : null, env.timezone);
  return (
    <PageHeader
      title={title}
      actions={<HeaderActions scope={scope} overview={overview} query={query} />}
      meta={overview ? <SnapshotStatus response={query.data} isError={query.isError} approvedOnly={scope.approvedOnly} timezone={env.timezone} /> : undefined}
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
