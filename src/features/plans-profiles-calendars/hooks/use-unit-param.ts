import { useSearchParams } from 'react-router-dom';

/**
 * One filter of a planning tab kept in the URL, so a reload, a shared link or a sub-page's Back keeps it; the
 * tab and the other parameters are kept, and history entries are replaced.
 */
export function useSearchParam(key: string): [string, (value: string) => void] {
  const [search, setSearch] = useSearchParams();
  const set = (value: string) =>
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  return [search.get(key) ?? '', set];
}

/** The unit chosen on a planning tab (`?unitId=`, the name deep links already use; QA planning). */
export function useUnitParam(): [string, (unitId: string) => void] {
  return useSearchParam('unitId');
}
