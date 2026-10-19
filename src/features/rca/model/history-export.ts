import { v2Request } from '@/api/v2/client';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import { historyActionLabel, historyActor, historyValueLines, visibleChangedFields, type HistoryResolvers } from './history-entry';

/** Upper bound of history pages one export reads (100 entries each). */
const MAX_PAGES = 50;

/** Every History entry of the investigation, newest first (keyset pages read on demand, QA M4). */
export async function fetchCaseHistory(rcaId: string): Promise<RcaHistoryEntryView[]> {
  const entries: RcaHistoryEntryView[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: Record<string, string | number> = cursor ? { limit: 100, cursor } : { limit: 100 };
    const response = await v2Request<ListResponse<RcaHistoryEntryView>>({ method: 'GET', path: `/rcas/${encodeURIComponent(rcaId)}/history`, query });
    entries.push(...response.data.items);
    cursor = response.data.nextCursor;
    if (!cursor) break;
  }
  return entries;
}

export type HistoryExportRow = ReturnType<typeof historyExportRow>;

/** One History entry as the export writes it: the words the History page shows, the instant as ISO / UTC. */
export function historyExportRow(entry: RcaHistoryEntryView, resolve: HistoryResolvers) {
  return {
    at: entry.at,
    what: historyActionLabel(entry.action),
    by: historyActor(entry),
    changed: visibleChangedFields(entry.changedFields),
    values: historyValueLines(entry, resolve).map((line) => ({ field: line.label, from: line.from, to: line.to })),
    reason: entry.reason,
  };
}
