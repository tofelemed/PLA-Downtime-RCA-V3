import { useCallback } from 'react';
import { useFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import { humanize } from '@/features/ux-kit/labels';

/**
 * A stored failure-mode key in words (QA L7: never `GEARBOX_FAILURE`): the plant dictionary's name of the
 * code (matched case-insensitively, as the server normalizes codes), else the humanized key.
 */
export function useFailureModeLabel(enabled = true): (code: string | null | undefined) => string | null {
  const { entries } = useFailureDictionary(enabled);
  return useCallback(
    (code) => {
      const key = code?.trim();
      if (!key) return null;
      const entry = entries.find((e) => e?.kind === 'failure_mode' && e.code?.trim().toLowerCase() === key.toLowerCase());
      return entry?.name ?? humanize(key);
    },
    [entries],
  );
}
