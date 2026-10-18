import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';
import type { ApprovalItem } from '../types/approvals';
import type { ListResponse } from '../types/envelopes';
import { v2Keys } from './query-keys';

type InboxPages = InfiniteData<ListResponse<ApprovalItem>, string | null>;
/** The inbox currently shares the close resource; never invalidate an unrelated close list here. */
function inboxQuery(query: Query): boolean {
  const filters: unknown = query.queryKey[6];
  return query.queryKey[3] === 'list' && typeof filters === 'object' && filters !== null && 'kind' in filters && filters.kind === 'approval-inbox';
}
const inboxFilters = (tenantId: string) => ({ queryKey: v2Keys.resource(tenantId, 'close'), predicate: inboxQuery });

/** A workspace decision must not leave a pre-decision snapshot to reuse when the user returns. */
export function refreshApprovalInbox(client: QueryClient, tenantId: string): Promise<void> {
  const filters = inboxFilters(tenantId);
  client.removeQueries({ ...filters, type: 'inactive' });
  return client.invalidateQueries({ ...filters, type: 'active' });
}
/** Server-confirmed removal only: cancel reads that began before the decision, then retain other rows. */
export async function removeDecidedApproval(client: QueryClient, tenantId: string, item: Pick<ApprovalItem, 'id' | 'kind'>): Promise<void> {
  const filters = inboxFilters(tenantId);
  await client.cancelQueries(filters);
  client.setQueriesData<InboxPages>(filters, (data) => data && ({
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((row) => row.id !== item.id || row.kind !== item.kind) })),
  }));
}
