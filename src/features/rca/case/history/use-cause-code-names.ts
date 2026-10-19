import { useCallback } from 'react';
import type { RcaCauseView } from '@/features/master-data/api/master-data-types';
import { RCA_CAUSES } from '@/features/master-data/api/record-resource';
import { useRecordLookup } from '@/features/master-data/api/use-record-queries';

/** "CODE — name" of a cause-library code by id (active and retired codes), for the history (QA L8). */
export function useCauseCodeNames(enabled = true): (id: string) => string | null {
  const codes = useRecordLookup<RcaCauseView>(RCA_CAUSES, { sort: 'code' }, enabled);
  const { items } = codes;
  return useCallback(
    (id: string) => {
      const code = items.find((item) => item.id === id);
      return code ? `${code.code} — ${code.name}` : null;
    },
    [items],
  );
}
