import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** A free-text search parameter of the page URL (empty text removes it; history entries are replaced). */
export function useUrlText(name: string): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? '';
  const set = useCallback(
    (next: string) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          if (next.trim() === '') copy.delete(name);
          else copy.set(name, next);
          return copy;
        },
        { replace: true },
      ),
    [name, setParams],
  );
  return [value, set];
}
