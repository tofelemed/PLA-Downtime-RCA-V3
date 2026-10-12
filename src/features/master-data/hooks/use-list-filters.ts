import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MasterDataSort, RecordStatusFilter } from '../api/master-data-types';

export interface ListFilters {
  q: string;
  status: RecordStatusFilter;
  sort: MasterDataSort;
}

const STATUSES: readonly RecordStatusFilter[] = ['active', 'retired', 'all'];
const SORTS: readonly MasterDataSort[] = ['code', '-code', 'name', '-name', 'createdAt', '-createdAt'];

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/**
 * Search, status and sort of a master-data list in the URL (`?q=&status=&sort=`), so Back and links keep
 * them. Defaults: active records, by code. Changing one resets nothing else.
 */
export function useListFilters(defaultSort: MasterDataSort = 'code') {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<ListFilters>(
    () => ({
      q: params.get('q') ?? '',
      status: pick(params.get('status'), STATUSES, 'active'),
      sort: pick(params.get('sort'), SORTS, defaultSort),
    }),
    [params, defaultSort],
  );
  const update = useCallback(
    (patch: Partial<ListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { filters, update };
}

/** The list query of the filters (a blank search is left out). */
export function listQueryOf(filters: ListFilters): Record<string, string> {
  return { status: filters.status, sort: filters.sort, ...(filters.q.trim() ? { q: filters.q.trim() } : {}) };
}
