import { V2ApiError } from '@/api/v2/errors';

/** The seven UX03 states plus `ready` (content). */
export type DataStateKind =
  | 'loading'
  | 'empty'
  | 'no-permission'
  | 'source-offline'
  | 'incomplete'
  | 'calculation-pending'
  | 'error'
  | 'ready';

export interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export interface DataStateFacts {
  isEmpty?: boolean;
  /** coverage below 100 % or missing inputs (AnalyticsResponse.dataQuality) */
  isIncomplete?: boolean;
  /** the server accepted a recalculation that has not finished (202 job running) */
  isCalculationPending?: boolean;
}

const OFFLINE_CODES = new Set(['SOURCE_OFFLINE', 'SOURCE_UNAVAILABLE', 'CONNECTION_UNAVAILABLE']);

/** The state a screen shows for a query plus what it knows about the data. */
export function dataStateOf(query: QueryLike, facts: DataStateFacts = {}): DataStateKind {
  if (query.isLoading) return 'loading';
  if (query.isError) {
    const error = query.error;
    if (error instanceof V2ApiError && error.status === 403) return 'no-permission';
    if (error instanceof V2ApiError && (OFFLINE_CODES.has(error.code) || error.status === 503)) {
      return 'source-offline';
    }
    return 'error';
  }
  if (facts.isCalculationPending) return 'calculation-pending';
  if (facts.isEmpty) return 'empty';
  if (facts.isIncomplete) return 'incomplete';
  return 'ready';
}
