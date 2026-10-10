import { Link } from 'react-router-dom';
import { useReconciliationStatus } from '@/api/v2/queries/pla-analytics';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { WORKFLOW_LABELS } from '@/features/plan-dashboard/model/display';
import { scopeToParams, statusQuery, type AnalyticsScope } from '../model/analytics-scope';

/** Reconciliation tiles of the dashboard: periods per workflow state and the overdue count (server counts). */
export function ReconciliationTiles({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReconciliationStatus(statusQuery(scope), env.timezone);
  const data = query.data?.data;
  const link = `/pla-analytics?${scopeToParams({ ...scope, tab: 'reconciliation' }).toString()}`;
  return (
    <ReportCard
      title="Reconciliation"
      testId="dashboard-reconciliation"
      query={query}
      response={query.data}
      isEmpty={data?.periods === 0}
      emptyText="No production periods in the last 7 days."
      actions={
        <Link className="text-sm underline" to={link}>
          Details
        </Link>
      }
    >
      {data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.workflow.map((w) => (
            <div key={w.state} className="rounded-md border p-3" data-testid="dashboard-workflow" data-key={w.state} data-count={w.periods}>
              <dt className="text-xs text-muted-foreground">{WORKFLOW_LABELS[w.state]}</dt>
              <dd className="text-xl font-semibold">{w.periods}</dd>
            </div>
          ))}
          <div className="rounded-md border p-3" data-testid="dashboard-overdue" data-count={data.overdueCount}>
            <dt className="text-xs text-muted-foreground">Overdue (&gt; {data.overdueAfterHours} h)</dt>
            <dd className="text-xl font-semibold">{data.overdueCount}</dd>
          </div>
        </dl>
      )}
    </ReportCard>
  );
}
