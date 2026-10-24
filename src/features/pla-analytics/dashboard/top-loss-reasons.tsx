import { useLossTree } from '@/api/v2/queries/pla-analytics';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { lossTreeQuery, type AnalyticsScope } from '../model/analytics-scope';

/** The five largest loss reasons of the window in the selected unit (server order and figures). */
export function TopLossReasons({ scope, uom }: { scope: AnalyticsScope; uom: string }) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope, { groupBy: 'reason', metric: 'qty', limit: 5 }), env.timezone);
  const groups = (query.data?.data.groups ?? []).filter((group) => group.unit === uom);
  const state = dataStateOf(query, { isEmpty: groups.length === 0 });
  return (
    <div className="space-y-2" data-testid="plan-top-reasons">
      <h3 className="text-sm font-medium">Top loss reasons</h3>
      <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No losses recorded in this window.">
        <ol className="space-y-1.5 text-sm">
          {groups.map((group) => (
            <li key={group.key ?? 'none'} className="flex items-baseline justify-between gap-3" data-testid="plan-top-reason">
              <span className="truncate">{group.label ?? 'Not categorised'}</span>
              <Quantity value={group.amount} uom={group.unit} className="tabular-nums" />
            </li>
          ))}
        </ol>
      </DataState>
    </div>
  );
}
