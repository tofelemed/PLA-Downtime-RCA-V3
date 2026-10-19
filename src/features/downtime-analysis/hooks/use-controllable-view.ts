import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** URL param of the controllable view (QA L17: shareable and kept after a reload). */
export const CONTROLLABLE_PARAM = 'controllable';

/** The "Show controllable view" switch state, kept in the URL (`controllable=1`). */
export function useControllableView(): [boolean, (next: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const checked = params.get(CONTROLLABLE_PARAM) === '1';
  const change = useCallback(
    (next: boolean) =>
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next) updated.set(CONTROLLABLE_PARAM, '1');
          else updated.delete(CONTROLLABLE_PARAM);
          return updated;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [checked, change];
}
