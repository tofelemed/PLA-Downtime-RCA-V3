import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * One search parameter restricted to `allowed` values (tabs, steps, filters), so Back works and the view
 * can be linked. Unknown or missing reads as `fallback`; writing the fallback removes the parameter.
 */
export function useUrlParam<T extends string>(name: string, allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(name);
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const set = useCallback(
    (next: T) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          if (next === fallback) copy.delete(name);
          else copy.set(name, next);
          return copy;
        },
        { replace: true },
      ),
    [fallback, name, setParams],
  );
  return [value, set];
}
