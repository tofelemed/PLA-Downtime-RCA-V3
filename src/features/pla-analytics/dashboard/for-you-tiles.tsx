import { useApprovalInbox } from '@/api/v2/queries/approvals';
import { useReconciliationQueue } from '@/api/v2/queries/period-sla';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import { useRcaActionPage } from '@/api/v2/queries/rca-pickers';
import type { ListResponse } from '@/api/v2/types/envelopes';
import { currentStopsQuery, defaultFilters } from '@/features/event-hub/model/event-filters';
import { pendingApprovalsHref } from '@/features/approvals/approval-links';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { AnalyticsScope } from '../model/analytics-scope';
import { downtimeHref, RCA_LIST_LINKS, stopsToCodeHref } from './dashboard-links';
import { pageCountText } from './for-you-model';
import { ForYouTile } from './for-you-tile';

/** The count text of the first server page of a list without a total (undefined while it loads). */
function usePageCount(page: Pick<ListResponse<unknown>, 'items' | 'nextCursor'> | undefined): string | undefined {
  const { number } = useNumberFormat();
  return page ? pageCountText(page.items.length, Boolean(page.nextCursor), number) : undefined;
}

const CURRENT_STOPS_REFRESH_MS = 30_000;

/** Ongoing stops of the scope: the same server query as the Event Hub / Downtime "Current stops" panel. */
export function CurrentStopsTile({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const filters = { ...defaultFilters({ from: '', to: '', label: '' }), unitIds: [...scope.unitIds] };
  const query = useProductionEvents(currentStopsQuery(filters), env.timezone, { refetchInterval: CURRENT_STOPS_REFRESH_MS });
  const first = query.data?.pages[0];
  const count = usePageCount(first);
  return (
    <ForYouTile testId="for-you-currentStops" title="Current stops" note="Ongoing now, in your units" to={downtimeHref(scope)}
      count={count} loading={query.isLoading} failed={query.isError} onRetry={() => void query.refetch()} />
  );
}

/** The event list has no total, so the tile opens the uncoded stops of the window instead of counting them. */
export function StopsToCodeTile({ scope }: { scope: AnalyticsScope }) {
  return <ForYouTile testId="for-you-stopsToCode" title="Stops to code" note={`Uncoded stops · ${scope.windowLabel}`} to={stopsToCodeHref(scope)} linkLabel="View stops to code" />;
}

/** Periods of "My work" (the reconciliation queue: to prepare, to review or escalated to you). */
export function PeriodsDueTile() {
  const queue = useReconciliationQueue();
  const first = queue.query.data?.pages[0];
  const retry = queue.status.onRetry;
  const count = usePageCount(first);
  return (
    <ForYouTile testId="for-you-periodsDue" title="Periods due" note="To prepare, review or handle as an escalation" to="/my-queue"
      count={count} loading={queue.status.isLoading} failed={queue.status.isError} onRetry={retry} />
  );
}

/** Open recommendations have no total either: a link to the Recommended tab. */
export function RecommendedTile() {
  return <ForYouTile testId="for-you-recommended" title="Recommended investigations" note="Stops the RCA policy flags for an investigation" to={RCA_LIST_LINKS.recommended} linkLabel="View recommended investigations" />;
}

/** The caller's own overdue corrective actions (`GET /v2/rca-actions?mine=true&overdue=true`, the Actions tab query). */
export function MyOverdueActionsTile() {
  const actions = useRcaActionPage({ mine: true, overdue: true });
  const first = actions.query.data?.pages[0];
  const retry = actions.status.onRetry;
  const count = usePageCount(first);
  return (
    <ForYouTile testId="for-you-myOverdueActions" title="My overdue actions" note="Your open or in-progress actions past their due date" to={RCA_LIST_LINKS.myOverdueActions}
      count={count} loading={actions.status.isLoading} failed={actions.status.isError} onRetry={retry} />
  );
}

/** Records waiting for the caller's approval roles: opens the inbox, or the one record's approval page when only one waits. */
export function ApprovalsTile() {
  const inbox = useApprovalInbox();
  const first = inbox.query.data?.pages[0];
  const retry = inbox.status.onRetry;
  const count = usePageCount(first);
  const to = pendingApprovalsHref(first);
  return (
    <ForYouTile testId="for-you-approvals" title="Pending approvals" note="Waiting for your approval roles" to={to} openLabel={to === '/approvals' ? undefined : 'open it'}
      count={count} loading={inbox.status.isLoading} failed={inbox.status.isError} onRetry={retry} />
  );
}
