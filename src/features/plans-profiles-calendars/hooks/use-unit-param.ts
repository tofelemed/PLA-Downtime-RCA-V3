import { useSearchParams } from 'react-router-dom';

const KEY = 'unitId';

/**
 * The unit chosen on a planning tab, kept in the URL (`?unitId=`, the name deep links already use) so a
 * reload or a shared link keeps it (QA planning); the tab and the other parameters are kept.
 */
export function useUnitParam(): [string, (unitId: string) => void] {
  const [search, setSearch] = useSearchParams();
  const set = (unitId: string) =>
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        if (unitId) next.set(KEY, unitId);
        else next.delete(KEY);
        return next;
      },
      { replace: true },
    );
  return [search.get(KEY) ?? '', set];
}
