import { useMemo } from 'react';
import { useRcaHistoryPage } from '@/api/v2/queries/rca-cases';
import { ListPager } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useUnitNames, useUserNames } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import type { HistoryResolvers } from '../../model/history-entry';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { HistoryEntryItem } from './history-entry-item';

function useHistoryResolvers(): HistoryResolvers {
  const { rca } = useCaseWorkspace();
  const users = useUserNames();
  const units = useUnitNames();
  const { day } = useRcaFormat();
  return useMemo(
    () => ({
      user: users.nameOf,
      unit: units.nameOf,
      day,
      recommendation: (id: string) => rca.recommendations.find((row) => row.id === id)?.title ?? null,
    }),
    [users, units, day, rca.recommendations],
  );
}

/** `/rca/:caseId/history`: who changed what on the case and its actions, links, analyses and causes (read-only). */
export function HistoryPage() {
  const { rca } = useCaseWorkspace();
  const { rows, pager, status } = useRcaHistoryPage(rca.id);
  const resolve = useHistoryResolvers();
  const { dateTime } = useRcaFormat();
  const state = dataStateOf(status, { isEmpty: rows.length === 0 });
  return (
    <Section title="History" description="Every change to this investigation, newest first, with who made it and when (plant time).">
      <DataState state={state} error={status.error} onRetry={status.onRetry} detail="No changes recorded yet.">
        <ul className="divide-y rounded border" data-testid="history-list" aria-busy={status.isRefreshing || undefined}>
          {rows.map((entry) => (
            <HistoryEntryItem key={entry.id} entry={entry} resolve={resolve} when={dateTime(entry.at)} />
          ))}
        </ul>
      </DataState>
      <ListPager pager={pager} label="History pages" />
    </Section>
  );
}
