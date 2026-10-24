import { useTransitionPerformance } from '@/api/v2/queries/ops-reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';
import { TransitionPairsTable, TransitionsTable } from './transition-tables';
import { ReportExportBar } from '../components/report-export-bar';

/**
 * Grade transition performance (R5, process engineer, planner): each product change against the approved
 * standard the calculation applied — duration and excess, loss within and over the allowance, off-grade —
 * and per product change the best, worst and mean, plus the transition loss in quantity and value.
 */
export function TransitionsReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useTransitionPerformance(scopeBase(scope), env.timezone);
  const data = query.data;
  const state = dataStateOf(query, { isEmpty: data !== undefined && data.transitions.length === 0 });
  return (
    <div className="space-y-4" data-testid="transitions-report">
      <ReportExportBar kind="transitions" query={scopeBase(scope)} timezone={env.timezone} />
      <DataState state={state} error={query.error} detail={state === 'empty' ? 'No grade transitions start on these dates.' : undefined} onRetry={() => void query.refetch()}>
        {data && (
          <>
            <ReportCard title="By product change" testId="transition-pairs">
              <TransitionPairsTable pairs={data.pairs} />
            </ReportCard>
            <ReportCard title="Transitions" testId="transition-list">
              <TransitionsTable rows={data.transitions} timeZone={env.timezone} />
              {data.truncated && <p className="text-xs text-muted-foreground">Showing the 500 latest transitions; choose fewer dates for the rest.</p>}
            </ReportCard>
          </>
        )}
      </DataState>
      <LossBreakdownCards scope={scope} groupBy="kind" kinds={['transition_allowance', 'transition_excess']} title="Transition loss" testId="transition-loss" />
    </div>
  );
}
