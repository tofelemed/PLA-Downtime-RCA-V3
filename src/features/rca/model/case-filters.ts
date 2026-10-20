import type { RcaCaseFilters } from '@/api/v2/queries/rca-cases';
import { RCA_PRIORITIES, RCA_STATUSES } from '@/api/v2/types/rca';

export const ALL = 'all';

/** Filters of the case list as kept in the URL (`?q=&status=&priority=&due=&open=&causeCodeId=`). */
export interface CaseListFilters {
  q: string;
  status: string;
  priority: string;
  /** `all`, `overdue` or `on-time` */
  due: string;
  /** `all`, `true` (not Closed) or `false` (Closed) */
  open: string;
  /** item 1.1: cases naming this catalogue cause code (drill from the recurring-cause ranking); absent = any */
  causeCodeId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pick = <T extends string>(values: readonly T[], value: string | null): string =>
  value && values.some((option) => option === value) ? value : ALL;

export function filtersFromParams(params: URLSearchParams): CaseListFilters {
  const due = params.get('due');
  const open = params.get('open');
  const causeCodeId = params.get('causeCodeId') ?? '';
  return {
    q: params.get('q') ?? '',
    status: pick(RCA_STATUSES, params.get('status')),
    priority: pick(RCA_PRIORITIES, params.get('priority')),
    due: due === 'overdue' || due === 'on-time' ? due : ALL,
    open: open === 'true' || open === 'false' ? open : ALL,
    ...(UUID.test(causeCodeId) ? { causeCodeId } : {}),
  };
}

/** Only the filters that are set, so a clean list keeps a clean URL. */
export function paramsFromFilters(filters: CaseListFilters): Record<string, string> {
  const entries = Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '' && entry[1] !== ALL);
  return Object.fromEntries(entries);
}

/** URL filters → server query (nothing is filtered in the browser). */
export function toCaseQuery(filters: CaseListFilters): RcaCaseFilters {
  return {
    q: filters.q.trim() || undefined,
    status: filters.status === ALL ? undefined : filters.status,
    priority: filters.priority === ALL ? undefined : filters.priority,
    overdue: filters.due === ALL ? undefined : filters.due === 'overdue',
    open: filters.open === ALL ? undefined : filters.open === 'true',
    causeCodeId: filters.causeCodeId || undefined,
  };
}

/** Old links (`/rca?case=…`, `/rca?rca=…`, `/rca?eventId=…`) → the route that replaced them. */
export function legacyRedirect(params: URLSearchParams): string | null {
  const caseId = params.get('case') ?? params.get('rca');
  if (caseId) return `/rca/${encodeURIComponent(caseId)}`;
  const eventId = params.get('eventId');
  return eventId ? `/rca/new?eventId=${encodeURIComponent(eventId)}` : null;
}

/** A clickable count of the list header (F-12): all cases, one status, overdue or critical. */
export type SummaryChip = { kind: 'all' } | { kind: 'status'; status: string } | { kind: 'overdue' } | { kind: 'critical' };

export const EMPTY_CASE_FILTERS: CaseListFilters = { q: '', status: ALL, priority: ALL, due: ALL, open: ALL };

/** The list filters a summary chip applies (the server filters; "open critical" = not Closed and priority Critical, as counted). */
export function filtersOfChip(chip: SummaryChip): CaseListFilters {
  if (chip.kind === 'status') return { ...EMPTY_CASE_FILTERS, status: chip.status };
  if (chip.kind === 'overdue') return { ...EMPTY_CASE_FILTERS, due: 'overdue' };
  if (chip.kind === 'critical') return { ...EMPTY_CASE_FILTERS, priority: 'Critical', open: 'true' };
  return EMPTY_CASE_FILTERS;
}

/** True when the list shows exactly what the chip filters (the chip is drawn pressed). */
export function isChipActive(chip: SummaryChip, filters: CaseListFilters): boolean {
  const wanted = filtersOfChip(chip);
  const same = (key: keyof CaseListFilters) => wanted[key] === filters[key];
  return same('status') && same('priority') && same('due') && same('open') && filters.q === '' && !filters.causeCodeId;
}
