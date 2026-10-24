import { Link } from 'react-router-dom';
import { useRcaSummary } from '@/api/v2/queries/rca-cases';
import type { RcaCaseSummaryCounts } from '@/api/v2/types/rca';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { RCA_LIST_LINKS } from './dashboard-links';
import { KpiTile, KpiTileRow } from './kpi-tile';

interface RcaTile {
  key: keyof Pick<RcaCaseSummaryCounts, 'open' | 'overdue' | 'critical' | 'overdueActions' | 'effectivenessPending'>;
  title: string;
  /** what the figure means (the tile's tooltip) */
  note: string;
  /** the filtered case or action list (UX audit G-6); effectiveness checks have no filterable list yet */
  to?: string;
}

const TILES: readonly RcaTile[] = [
  { key: 'open', title: 'Open investigations', note: 'Investigations not closed', to: RCA_LIST_LINKS.open },
  { key: 'overdue', title: 'Overdue investigations', note: 'Open investigations past their due date', to: RCA_LIST_LINKS.overdue },
  { key: 'critical', title: 'Open critical', note: 'Critical priority investigations, not closed', to: RCA_LIST_LINKS.critical },
  { key: 'overdueActions', title: 'Overdue actions', note: 'Open or in-progress actions past their due date', to: RCA_LIST_LINKS.overdueActions },
  { key: 'effectivenessPending', title: 'Effectiveness pending', note: 'Actions waiting for their effectiveness result' },
];

function TileCount({ tile, count }: { tile: RcaTile; count: string }) {
  if (!tile.to) return <>{count}</>;
  return (
    <Link className="underline decoration-1 underline-offset-4" to={tile.to} aria-label={`${tile.title}: ${count}, open the list`}>
      {count}
    </Link>
  );
}

/** The five RCA counts of the caller's scope (server counts); the first four open their filtered list. */
export function RcaTiles() {
  const query = useRcaSummary();
  const data = query.data;
  const { number } = useNumberFormat();
  return (
    <div className="space-y-3" data-testid="dashboard-rca">
      {query.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => query.refetch()}>
          {data && (
            <KpiTileRow>
              {TILES.map((tile) => (
                <KpiTile
                  key={tile.key}
                  spec={{ title: tile.title, info: tile.note }}
                  value={
                    <span data-testid={`dashboard-rca-${tile.key}`} data-count={data[tile.key]}>
                      <TileCount tile={tile} count={number(data[tile.key])} />
                    </span>
                  }
                  testId={`dashboard-rca-${tile.key}-tile`}
                />
              ))}
            </KpiTileRow>
          )}
        </DataState>
      )}
    </div>
  );
}
