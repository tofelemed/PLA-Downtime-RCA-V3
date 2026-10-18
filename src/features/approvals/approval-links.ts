import type { ApprovalItem } from '@/api/v2/types/approvals';

/** The approval detail page of one pending record (`/approvals/:kind/:id`). */
export function approvalHref(item: Pick<ApprovalItem, 'kind' | 'id'>): string {
  return `/approvals/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}`;
}

/** Where a "pending approvals" count opens: the single record when there is exactly one, else the inbox. */
export function pendingApprovalsHref(page: { items: ReadonlyArray<Pick<ApprovalItem, 'kind' | 'id'>>; nextCursor: string | null } | undefined): string {
  const only = page && page.items.length === 1 && !page.nextCursor ? page.items[0] : null;
  return only ? approvalHref(only) : '/approvals';
}
