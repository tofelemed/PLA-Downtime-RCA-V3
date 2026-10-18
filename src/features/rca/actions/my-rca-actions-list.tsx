import { Link } from 'react-router-dom';
import type { RcaActionQueueFilters } from '@/api/v2/queries/rca-pickers';
import { ALL_MY_ACTIONS_PATH, DEFAULT_ACTION_FILTERS, ownerActionQuery, paramsFromActionFilters, type OwnerStatus } from '../model/action-queue-filters';
import { ActionQueueTable } from './action-queue-table';

export interface MyRcaActionsListProps {
  /** default true: only the signed-in user's actions */
  mine?: boolean;
  /** true: only open / in-progress actions past their due date */
  overdue?: boolean;
  /** with `mine`: which of the user's actions (default: still to do) */
  status?: OwnerStatus;
  /** rows per page (default 5) */
  limit?: number;
  /** default true: the footer link to the full list (off where this already is the full list) */
  showAllLink?: boolean;
}

/** Mine and/or overdue; without "overdue", the status filter (default: actions still to do). */
function queryOf(mine: boolean, overdue: boolean, status: OwnerStatus): RcaActionQueueFilters {
  if (overdue) return { mine: mine || undefined, overdue: true };
  return { ...ownerActionQuery(status), mine: mine || undefined };
}

/** The full "Actions" tab: every action I own (any status), or the same mine / overdue filters. */
function allPathOf(mine: boolean, overdue: boolean): string {
  if (mine && !overdue) return ALL_MY_ACTIONS_PATH;
  return `/rca?${new URLSearchParams(paramsFromActionFilters({ ...DEFAULT_ACTION_FILTERS, mine, overdue })).toString()}`;
}

const EMPTY_TEXT: Readonly<Record<OwnerStatus, string>> = {
  open: 'No open RCA actions.',
  done: 'No done RCA actions.',
  all: 'No RCA actions.',
};

/**
 * F-7: a compact list of RCA actions (`GET /v2/rca-actions`, due date first) for embedding, e.g. in My
 * Queue; each row links its investigation and the footer opens the full "Actions" tab: every action the
 * user owns, whatever its status (Marun G2), or the overdue ones.
 */
export function MyRcaActionsList({ mine = true, overdue = false, status = 'open', limit = 5, showAllLink = true }: MyRcaActionsListProps) {
  const allPath = allPathOf(mine, overdue);
  return (
    <div className="space-y-2" data-testid="my-rca-actions">
      <ActionQueueTable
        caption={mine ? 'My RCA actions' : 'RCA actions'}
        filters={queryOf(mine, overdue, status)}
        pageSize={limit}
        empty={{ title: 'No actions', text: overdue ? 'No overdue RCA actions.' : EMPTY_TEXT[status] }}
      />
      {showAllLink && (
        <Link className="text-sm underline" to={allPath} data-testid="all-rca-actions-link">
          All RCA actions
        </Link>
      )}
    </div>
  );
}
