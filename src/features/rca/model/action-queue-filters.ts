import type { RcaActionQueueFilters } from '@/api/v2/queries/rca-pickers';
import type { StatusTone } from '@/features/ux-kit/status-tone';

export const ACTION_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ANY = 'all';

export const ACTION_STATUS_TONES: Readonly<Record<ActionStatus, StatusTone>> = {
  open: 'info',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
};

export const asActionStatus = (value: string): ActionStatus | null => ACTION_STATUSES.find((status) => status === value) ?? null;

/** Filters of the "Actions" tab as kept in the URL (`?tab=actions&mine=false&overdue=true&status=&unitId=`). */
export interface ActionQueueFilters {
  /** default on: only the signed-in user's actions */
  mine: boolean;
  overdue: boolean;
  /** an action status or `all` */
  status: string;
  /** a unit id or `all` */
  unitId: string;
}

export const DEFAULT_ACTION_FILTERS: ActionQueueFilters = { mine: true, overdue: false, status: ANY, unitId: ANY };

export function actionFiltersFromParams(params: URLSearchParams): ActionQueueFilters {
  return {
    mine: params.get('mine') !== 'false',
    overdue: params.get('overdue') === 'true',
    status: asActionStatus(params.get('status') ?? '') ?? ANY,
    unitId: params.get('unitId') || ANY,
  };
}

/** Only what differs from the defaults, so the default tab keeps a short URL. */
export function paramsFromActionFilters(filters: ActionQueueFilters): Record<string, string> {
  return {
    tab: 'actions',
    ...(filters.mine ? {} : { mine: 'false' }),
    ...(filters.overdue ? { overdue: 'true' } : {}),
    ...(filters.status === ANY ? {} : { status: filters.status }),
    ...(filters.unitId === ANY ? {} : { unitId: filters.unitId }),
  };
}

/** URL filters → server query (nothing is filtered in the browser). */
export function toActionQuery(filters: ActionQueueFilters): RcaActionQueueFilters {
  const status = asActionStatus(filters.status);
  return {
    mine: filters.mine || undefined,
    overdue: filters.overdue || undefined,
    status: status ? [status] : undefined,
    unitId: filters.unitId === ANY ? undefined : filters.unitId,
  };
}

/** Status filter of an action owner's own list (`/rca` without analysis roles, Marun G2). */
export const OWNER_STATUSES = ['open', 'done', 'all'] as const;
export type OwnerStatus = (typeof OWNER_STATUSES)[number];

export const OWNER_STATUS_LABELS: Readonly<Record<OwnerStatus, string>> = {
  open: 'To do (open or in progress)',
  done: 'Done',
  all: 'All',
};

/** `?status=` of the owner list; anything else is the default "to do". */
export function ownerStatusFromParams(params: URLSearchParams): OwnerStatus {
  const value = params.get('status');
  return OWNER_STATUSES.find((status) => status === value) ?? 'open';
}

/** The owner's own actions in that status (the server filters; `all` includes cancelled). */
export function ownerActionQuery(status: OwnerStatus): RcaActionQueueFilters {
  if (status === 'done') return { mine: true, status: ['done'] };
  if (status === 'all') return { mine: true };
  return { mine: true, status: ['open', 'in_progress'] };
}

/** The full "Actions" tab with every action the user owns, whatever its status. */
export const ALL_MY_ACTIONS_PATH = '/rca?tab=actions&mine=true&status=all';
