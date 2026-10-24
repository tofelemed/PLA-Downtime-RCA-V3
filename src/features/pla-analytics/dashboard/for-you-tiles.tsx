import { useApprovalInbox } from '@/api/v2/queries/approvals';
import { useReconciliationQueue } from '@/api/v2/queries/period-sla';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import { useRcaActionPage } from '@/api/v2/queries/rca-pickers';
import { currentStopsQuery, defaultFilters, toCodeFilters, toEventQuery } from '@/features/event-hub/model/event-filters';
import { pendingApprovalsHref } from '@/features/approvals/approval-links';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { AnalyticsScope } from '../model/analytics-scope';
import { downtimeHref, RCA_LIST_LINKS, stopsToCodeHref } from './dashboard-links';
import { ForYouTile } from './for-you-tile';
import { usePageCount } from '@/features/ux-kit/use-page-count';

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

/**
 * The uncoded stops of the window (QA PLA re-test: the tile had no count): the Event Hub "To code" server
 * query of the same units and window; the list has no total, so a full first page reads "20+".
 */
export function StopsToCodeTile({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const window = { from: scope.from, to: scope.to, label: scope.windowLabel };
  const filters = toCodeFilters({ ...defaultFilters(window), from: scope.from, to: scope.to, unitIds: [...scope.unitIds] });
  const query = useProductionEvents(toEventQuery(filters), env.timezone);
  const count = usePageCount(query.data?.pages[0]);
  return (
    <ForYouTile testId="for-you-stopsToCode" title="Stops to code" note={`Uncoded stops · ${scope.windowLabel}`} to={stopsToCodeHref(scope)}
      count={count} loading={query.isLoading} failed={query.isError} onRetry={() => void query.refetch()} />
  );
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

/** Records the caller can decide: opens the inbox, or the one record's approval page when only one waits. */
export function ApprovalsTile() {
  const inbox = useApprovalInbox(undefined, true);
  const first = inbox.query.data?.pages[0];
  const retry = inbox.status.onRetry;
  const count = usePageCount(first);
  const to = pendingApprovalsHref(first);
  return (
    <ForYouTile testId="for-you-approvals" title="Pending approvals" note="Waiting for your decision" to={to} openLabel={to === '/approvals' ? undefined : 'open it'} attention={(first?.items.length ?? 0) > 0}
      count={count} loading={inbox.status.isLoading} failed={inbox.status.isError} onRetry={retry} />
  );
}
