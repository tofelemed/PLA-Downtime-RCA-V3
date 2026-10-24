import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { KpiInfo } from './kpi-info';

export interface ForYouTileProps {
  testId: string;
  title: string;
  /** what the tile counts; shown in the tile's ⓘ tooltip */
  note: string;
  /** something waits for the user: amber edge */
  attention?: boolean;
  to: string;
  /** a server count, already formatted; absent: the tile is a link only (the list has no total) */
  count?: string;
  /** link text of a link-only tile */
  linkLabel?: string;
  /** what the count link does, for its accessible name (default "open the list") */
  openLabel?: string;
  loading?: boolean;
  /** the count could not be loaded */
  failed?: boolean;
  onRetry?: () => void;
}

function TileValue({ title, to, count, linkLabel, openLabel = 'open the list', loading, failed, onRetry }: Omit<ForYouTileProps, 'testId' | 'note' | 'attention'>) {
  if (loading) return <Skeleton className="h-7 w-12" role="status" aria-label={`Loading ${title}`} />;
  if (failed) {
    return (
      <span className="flex items-center gap-2 text-sm">
        Couldn&apos;t load.
        <Button size="sm" variant="link" className="h-auto p-0" onClick={onRetry}>
          Retry
        </Button>
      </span>
    );
  }
  if (count === undefined) {
    return (
      <Link className="text-sm font-medium underline underline-offset-4" to={to}>
        {linkLabel ?? title}
      </Link>
    );
  }
  return (
    <Link className="underline decoration-1 underline-offset-4" to={to} aria-label={`${title}: ${count}, ${openLabel}`}>
      {count}
    </Link>
  );
}

/** One tile of the dashboard's "For you" row: a server count that opens its filtered list, or a link. */
export function ForYouTile({ testId, note, attention, ...value }: ForYouTileProps) {
  return (
    <div
      className={cn('min-w-0 rounded-md border bg-canvas p-3', attention && 'for-you-attention border-warning shadow-[inset_3px_0_0_hsl(var(--warning))]')}
      data-testid={testId}
      data-count={value.count}
    >
      <dt className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{value.title}</span>
        <KpiInfo label={value.title} text={note} />
      </dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums">
        <TileValue {...value} />
      </dd>
    </div>
  );
}
