import { Button } from '@/components/ui/button';

export interface LoadMoreProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

/** Next keyset page of a server list (never the whole tenant at once). */
export function LoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage }: LoadMoreProps) {
  if (!hasNextPage) return null;
  return (
    <Button size="sm" variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
      {isFetchingNextPage ? 'Loading…' : 'Load more'}
    </Button>
  );
}
