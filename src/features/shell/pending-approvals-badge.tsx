import { useApprovalInbox } from '@/api/v2/queries/approvals';
import { usePageCount } from '@/features/pla-analytics/dashboard/use-page-count';

/** The "N" / "N+" first-page count of the caller's pending approvals (the Dashboard tile's rule); undefined while loading or at 0. */
export function usePendingApprovalsCount(): string | undefined {
  const first = useApprovalInbox(undefined, true).query.data?.pages[0];
  const count = usePageCount(first);
  return first && first.items.length > 0 ? count : undefined;
}
