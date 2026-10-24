import { useEventStatus } from '@/api/v2/queries/ops-reports';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { EventStatusRows } from './event-status-rows';

/** How far the window's loss events are coded and verified (R1): what the figures above can be trusted for. */
export function EventStatusCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useEventStatus(scopeBase(scope), env.timezone);
  const rows = query.data?.rows ?? [];
  const state = dataStateOf(query, { isEmpty: query.data !== undefined && rows.length === 0 });
  return (
    <ReportCard title="Events: coding and verification" testId="daily-event-status">
      <DataState state={state} error={query.error} detail={state === 'empty' ? 'No loss events start on these dates.' : undefined} onRetry={() => void query.refetch()}>
        <EventStatusRows rows={rows} />
      </DataState>
    </ReportCard>
  );
}
