import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RcaActionQueueFilters } from '@/api/v2/queries/rca-pickers';
import { ALL_MY_ACTIONS_PATH, DEFAULT_ACTION_FILTERS, ownerActionQuery, paramsFromActionFilters, type OwnerStatus } from '../model/action-queue-filters';
import { ActionQueueTable } from './action-queue-table';
import { OwnerStatusFilter } from './owner-status-filter';

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
  /**
   * QA L16: show a Status filter (still to do / done / all) above the list, starting at `status`; for
   * embeddings such as My work. Ignored with `overdue`. Default false (the caller filters).
   */
  statusFilter?: boolean;
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

const LIST_DEFAULTS: Required<MyRcaActionsListProps> = { mine: true, overdue: false, status: 'open', limit: 5, showAllLink: true, statusFilter: false };

/** The status the list shows: the user's choice in the embedded filter (QA L16), else the caller's. */
function useShownStatus(status: OwnerStatus, withFilter: boolean) {
  const [chosen, setChosen] = useState<OwnerStatus>(status);
  return { chosen, setChosen, shown: withFilter ? chosen : status };
}

const emptyTextOf = (overdue: boolean, status: OwnerStatus) => (overdue ? 'No overdue RCA actions.' : EMPTY_TEXT[status]);

/**
 * F-7: a compact list of RCA actions (`GET /v2/rca-actions`, due date first) for embedding, e.g. in My
 * Queue; each row links its investigation and the footer opens the full "Actions" tab: every action the
 * user owns, whatever its status (Marun G2), or the overdue ones. `statusFilter` adds the Status filter.
 */
export function MyRcaActionsList(props: MyRcaActionsListProps) {
  const { mine, overdue, status, limit, showAllLink, statusFilter } = { ...LIST_DEFAULTS, ...props };
  const filterId = useId();
  const withFilter = statusFilter && !overdue;
  const { chosen, setChosen, shown } = useShownStatus(status, withFilter);
  return (
    <div className="space-y-2" data-testid="my-rca-actions">
      {withFilter && <OwnerStatusFilter id={`${filterId}-status`} value={chosen} onChange={setChosen} />}
      <ActionQueueTable
        caption={mine ? 'My RCA actions' : 'RCA actions'}
        filters={queryOf(mine, overdue, shown)}
        pageSize={limit}
        empty={{ title: 'No actions', text: emptyTextOf(overdue, shown) }}
      />
      {showAllLink && (
        <Link className="text-sm underline" to={allPathOf(mine, overdue)} data-testid="all-rca-actions-link">
          All RCA actions
        </Link>
      )}
    </div>
  );
}
