import { useRcaHistoryPage } from '@/api/v2/queries/rca-cases';
import { ListPager } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { historyTotalOf, withTotal } from '../../model/history-pager';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { CaseRecordTable, type CaseRecordColumn } from '../components/case-record-table';
import { HistoryEntryItem } from './history-entry-item';
import { useHistoryResolvers } from './use-history-resolvers';

const COLUMNS: readonly CaseRecordColumn[] = [
  { id: 'when', header: 'When', width: '10rem' },
  { id: 'by', header: 'By', width: '11rem' },
  { id: 'change', header: 'Change' },
];

/** `/rca/:caseId/history`: who changed what on the case and its actions, links, analyses and causes (read-only). */
export function HistoryPage() {
  const { rca } = useCaseWorkspace();
  const { rows, pager: keysetPager, status, query } = useRcaHistoryPage(rca.id);
  const pager = withTotal(keysetPager, historyTotalOf(query.data?.pages));
  const resolve = useHistoryResolvers();
  const { dateTime } = useRcaFormat();
  const state = dataStateOf(status, { isEmpty: rows.length === 0 });
  return (
    <CaseCard title="History" info="Every change to this investigation, newest first, with who made it and when (plant time).">
      <DataState state={state} error={status.error} onRetry={status.onRetry} detail="No changes recorded yet.">
        <CaseRecordTable caption="History of this investigation" columns={COLUMNS} testId="history-list" busy={status.isRefreshing}>
          {rows.map((entry) => (
            <HistoryEntryItem key={entry.id} entry={entry} resolve={resolve} when={dateTime(entry.at)} />
          ))}
        </CaseRecordTable>
      </DataState>
      <ListPager pager={pager} label="History pages" />
    </CaseCard>
  );
}
