import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const MAX_ID_LENGTH = 128;

/** The guide's optional production unit, kept in `?unitId=` so a link to the guide shares it. */
export function useGuideUnit() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('unitId') ?? '';
  const unitId = raw.length <= MAX_ID_LENGTH ? raw : '';
  const setUnitId = useCallback((next: string) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next) updated.set('unitId', next);
      else updated.delete('unitId');
      return updated;
    }, { replace: true });
  }, [setParams]);
  return [unitId, setUnitId] as const;
}
