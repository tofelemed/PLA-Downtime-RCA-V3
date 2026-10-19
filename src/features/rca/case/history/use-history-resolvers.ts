import { useMemo } from 'react';
import { useUnitNames, useUserNames } from '@/features/ux-kit/labels';
import type { HistoryResolvers } from '../../model/history-entry';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { useCauseCodeNames } from './use-cause-code-names';

/**
 * Names for the ids and dates of the case's History (page and export): people, units, days, recommendations
 * and cause codes (the cause library is read only when `enabled`).
 */
export function useHistoryResolvers(enabled = true): HistoryResolvers {
  const { rca } = useCaseWorkspace();
  const users = useUserNames();
  const units = useUnitNames();
  const { day } = useRcaFormat();
  const causeCode = useCauseCodeNames(enabled);
  return useMemo(
    () => ({
      user: users.nameOf,
      unit: units.nameOf,
      day,
      recommendation: (id: string) => rca.recommendations.find((row) => row.id === id)?.title ?? null,
      causeCode,
    }),
    [users, units, day, rca.recommendations, causeCode],
  );
}
