import type { QueryOf } from '../schema-types';
import type { ProductionEventView } from '../types/events';
import type { LossLinePickerView, RcaActionListItemView, RcaOccurrenceView } from '../types/rca-pickers';
import { usePagedQuery } from './use-paged-query';

type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/** Only the parameters that are set (an empty list or text is not sent). */
function compact<T extends object>(filters: T): Partial<Defined<T>> {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0));
  return Object.fromEntries(entries) as Partial<Defined<T>>;
}

export type RcaActionQueueFilters = Omit<QueryOf<'/api/v2/rca-actions', 'get'>, 'cursor' | 'limit' | 'sort'>;

/** F-7: actions across the investigations of the scope, due date first (keyset pages; undated last). */
export function useRcaActionPage(filters: RcaActionQueueFilters, pageSize?: number) {
  const query = { ...compact(filters), sort: 'dueDate' };
  return usePagedQuery<RcaActionListItemView>({
    resource: 'rca-cases',
    path: '/rca-actions',
    query,
    key: { filters: { list: 'rca-actions', ...query } },
    pageSize,
  });
}

export type RcaOccurrenceFilters = Omit<QueryOf<'/api/v2/occurrences', 'get'>, 'cursor' | 'limit' | 'sort'>;

/** Stop occurrences to link, newest first; needs a window (≤ 366 days) or an event id. */
export function useRcaOccurrencePage(filters: RcaOccurrenceFilters, enabled = true) {
  const query = { ...compact(filters), sort: '-startTime' };
  return usePagedQuery<RcaOccurrenceView>({
    resource: 'production-events',
    path: '/occurrences',
    query,
    key: { filters: { list: 'occurrences', ...query } },
    pageSize: 10,
    enabled,
  });
}

export type LossLineFilters = Omit<QueryOf<'/api/v2/loss-lines', 'get'>, 'cursor' | 'limit' | 'sort'>;

/** Plan-ledger loss lines to link, newest period first (keyset). */
export function useLossLinePage(filters: LossLineFilters, enabled = true) {
  const query = { ...compact(filters), sort: '-periodStart' };
  return usePagedQuery<LossLinePickerView>({
    resource: 'period-accounting',
    path: '/loss-lines',
    query,
    key: { filters: { list: 'loss-lines', ...query } },
    pageSize: 10,
    enabled,
  });
}

export type EventPickerFilters = Pick<QueryOf<'/api/v2/production-events', 'get'>, 'unitIds' | 'reasonIds' | 'q' | 'from' | 'to'>;

/** Production events to link to an investigation, newest first (the same list as the Event Hub, 10 per page). */
export function useEventPickerPage(filters: EventPickerFilters) {
  const query = { ...compact(filters), sort: '-startTime' };
  return usePagedQuery<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query,
    key: { filters: { list: 'rca-event-picker', ...query } },
    pageSize: 10,
  });
}
