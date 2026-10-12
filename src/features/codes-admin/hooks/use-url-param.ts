import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * One search parameter of the page URL restricted to `allowed` values (tabs, the chosen library, list
 * filters), so Back works and the view can be linked. An unknown or missing value reads as `fallback`;
 * writing the fallback removes the parameter. Other parameters are kept; history entries are replaced.
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
