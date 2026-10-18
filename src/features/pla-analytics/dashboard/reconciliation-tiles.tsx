import { Link } from 'react-router-dom';
import { useReconciliationStatus } from '@/api/v2/queries/pla-analytics';
import { GRID_WORKFLOW_LABELS } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { statusQuery, type AnalyticsScope } from '../model/analytics-scope';
import { plaHref } from './dashboard-links';

/** Reconciliation tiles of the dashboard: periods per workflow state and the overdue count (server counts). */
export function ReconciliationTiles({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReconciliationStatus(statusQuery(scope), env.timezone);
  const data = query.data?.data;
  const { number } = useNumberFormat();
  const link = plaHref(scope, '/pla-analytics/reconciliation');
  return (
    <AnalyticsCard
      title="Periods by workflow state"
      testId="dashboard-reconciliation"
      query={query}
      response={query.data}
      isEmpty={data?.periods === 0}
      emptyText={`No production periods in the ${scope.windowLabel.toLowerCase()}.`}
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
              <dt className="text-xs text-muted-foreground">{GRID_WORKFLOW_LABELS[w.state]}</dt>
              <dd className="text-xl font-semibold">{number(w.periods)}</dd>
            </div>
          ))}
          <div className="rounded-md border p-3" data-testid="dashboard-overdue" data-count={data.overdueCount}>
            <dt className="text-xs text-muted-foreground">Overdue (past the reconciliation deadline)</dt>
            <dd className="text-xl font-semibold">{number(data.overdueCount)}</dd>
          </div>
        </dl>
      )}
    </AnalyticsCard>
  );
}
