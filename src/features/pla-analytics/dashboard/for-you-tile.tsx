import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface ForYouTileProps {
  testId: string;
  title: string;
  note: string;
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

function TileValue({ title, to, count, linkLabel, openLabel = 'open the list', loading, failed, onRetry }: Omit<ForYouTileProps, 'testId' | 'note'>) {
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
export function ForYouTile({ testId, note, ...value }: ForYouTileProps) {
  return (
    <div className="rounded-md border p-3" data-testid={testId} data-count={value.count}>
      <dt className="text-xs text-muted-foreground">{value.title}</dt>
      <dd className="text-xl font-semibold">
        <TileValue {...value} />
      </dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}
