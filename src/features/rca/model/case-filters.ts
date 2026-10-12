import type { RcaCaseFilters } from '@/api/v2/queries/rca-cases';
import { RCA_PRIORITIES, RCA_STATUSES } from '@/api/v2/types/rca';

export const ALL = 'all';

/** Filters of the case list as kept in the URL (`?q=&status=&priority=&overdue=`). */
export interface CaseListFilters {
  q: string;
  status: string;
  priority: string;
  /** `all`, `overdue` or `on-time` */
  due: string;
}

const pick = <T extends string>(values: readonly T[], value: string | null): string =>
  value && values.some((option) => option === value) ? value : ALL;

export function filtersFromParams(params: URLSearchParams): CaseListFilters {
  const due = params.get('due');
  return {
    q: params.get('q') ?? '',
    status: pick(RCA_STATUSES, params.get('status')),
    priority: pick(RCA_PRIORITIES, params.get('priority')),
    due: due === 'overdue' || due === 'on-time' ? due : ALL,
  };
}

/** Only the filters that are set, so a clean list keeps a clean URL. */
export function paramsFromFilters(filters: CaseListFilters): Record<string, string> {
  const entries = Object.entries(filters).filter(([, value]) => value !== '' && value !== ALL);
  return Object.fromEntries(entries);
}

/** URL filters → server query (nothing is filtered in the browser). */
export function toCaseQuery(filters: CaseListFilters): RcaCaseFilters {
  return {
    q: filters.q.trim() || undefined,
    status: filters.status === ALL ? undefined : filters.status,
    priority: filters.priority === ALL ? undefined : filters.priority,
    overdue: filters.due === ALL ? undefined : filters.due === 'overdue',
  };
}

/** Old links (`/rca?case=…`, `/rca?rca=…`, `/rca?eventId=…`) → the route that replaced them. */
export function legacyRedirect(params: URLSearchParams): string | null {
  const caseId = params.get('case') ?? params.get('rca');
  if (caseId) return `/rca/${encodeURIComponent(caseId)}`;
  const eventId = params.get('eventId');
  return eventId ? `/rca/new?eventId=${encodeURIComponent(eventId)}` : null;
}
