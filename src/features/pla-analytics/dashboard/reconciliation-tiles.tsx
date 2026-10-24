import { Link } from 'react-router-dom';
import { useReconciliationStatus } from '@/api/v2/queries/pla-analytics';
import type { ReconciliationStatusView } from '@/api/v2/types/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { GRID_WORKFLOW_LABELS } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { statusQuery, type AnalyticsScope } from '../model/analytics-scope';
import { plaHref } from './dashboard-links';
import { KpiSection } from './kpi-section';
import { KpiTile, KpiTileRow } from './kpi-tile';

const OVERDUE_INFO = 'Overdue (past the reconciliation deadline): periods still open after their reconciliation deadline.';

function workflowInfo(state: string): string {
  return `Production periods of the window in the workflow state "${state}".`;
}

function CountLink({ to, count, testId, stateKey }: { to: string; count: number; testId: string; stateKey?: string }) {
  const { number } = useNumberFormat();
  return (
    <Link to={to} className="hover:underline" data-testid={testId} data-count={count} data-key={stateKey}>
      {number(count)}
    </Link>
  );
}

function Tiles({ data, to }: { data: ReconciliationStatusView; to: string }) {
  return (
    <KpiTileRow>
      {data.workflow.map((w) => (
        <KpiTile
          key={w.state}
          spec={{ title: GRID_WORKFLOW_LABELS[w.state], info: workflowInfo(GRID_WORKFLOW_LABELS[w.state]) }}
          value={<CountLink to={to} count={w.periods} testId="dashboard-workflow" stateKey={w.state} />}
          testId={`dashboard-workflow-${w.state}-tile`}
        />
      ))}
      <KpiTile
        spec={{ title: 'Overdue', info: OVERDUE_INFO, highlight: data.overdueCount > 0 }}
        value={<CountLink to={to} count={data.overdueCount} testId="dashboard-overdue" />}
        testId="dashboard-overdue-tile"
      />
    </KpiTileRow>
  );
}

/** Reconciliation of the window: periods per workflow state and the overdue count (server counts), each linking to the details. */
export function ReconciliationTiles({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReconciliationStatus(statusQuery(scope), env.timezone);
  const data = query.data?.data;
  const to = plaHref(scope, '/pla-analytics/reconciliation');
  const emptyText = `No production periods in the ${scope.windowLabel.toLowerCase()}.`;
  return (
    <KpiSection title="Reconciliation" link={{ to, label: 'Details' }}>
      <div data-testid="dashboard-reconciliation">
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <DataState state={dataStateOf(query, { isEmpty: data?.periods === 0 })} error={query.error} detail={emptyText} onRetry={() => query.refetch()}>
            {data && <Tiles data={data} to={to} />}
          </DataState>
        )}
      </div>
    </KpiSection>
  );
}
