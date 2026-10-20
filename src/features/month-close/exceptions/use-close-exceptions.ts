import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { ExceptionType, ReconciliationExceptionView } from '@/api/v2/types/reconciliation-exceptions';

export interface CloseExceptionsQuery {
  /** the month's first operational date and the day after its last (exclusive) */
  fromDate: string;
  toDate: string;
  type: ExceptionType | null;
  unitId: string | null;
}

/** Plan 2.4: the open accounting problems of the month's periods, keyset-paged by the server. */
export function useCloseExceptions(query: CloseExceptionsQuery) {
  const filters = {
    fromDate: query.fromDate,
    toDate: query.toDate,
    ...(query.type ? { types: [query.type] } : {}),
    ...(query.unitId ? { unitIds: [query.unitId] } : {}),
  };
  return usePagedQuery<ReconciliationExceptionView>({
    resource: 'close',
    path: '/reconciliation/exceptions',
    query: filters,
    key: { filters: { kind: 'reconciliation-exceptions', ...filters } },
  });
}
