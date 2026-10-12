import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filters kept in the URL (`?status=Open&q=pump`), so Back restores them and the list can be linked.
 * Every filter is a string; the empty string (or the default) removes the parameter. Changing a filter
 * replaces the history entry (typing does not stack Back steps).
 */
export function useUrlFilters<K extends string>(defaults: Readonly<Record<K, string>>) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const next: Record<K, string> = { ...defaults };
    for (const key of Object.keys(defaults) as K[]) {
      const value = params.get(key);
      if (value !== null) next[key] = value;
    }
    return next;
  }, [params, defaults]);
  const set = useCallback(
    (patch: Partial<Record<K, string>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch) as Array<[K, string | undefined]>) {
            if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );
  return [values, set] as const;
}
