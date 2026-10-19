import { Link } from 'react-router-dom';
import { useRcaSummary } from '@/api/v2/queries/rca-cases';
import type { RcaCaseSummaryCounts } from '@/api/v2/types/rca';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { AnalyticsCard } from '../components/analytics-card';
import { RCA_LIST_LINKS } from './dashboard-links';

interface RcaTile {
  key: keyof Pick<RcaCaseSummaryCounts, 'open' | 'overdue' | 'critical' | 'overdueActions' | 'effectivenessPending'>;
  title: string;
  note: string;
  /** the filtered case or action list (UX audit G-6); effectiveness checks have no filterable list yet */
  to?: string;
}

const TILES: readonly RcaTile[] = [
  { key: 'open', title: 'Open investigations', note: 'Investigations not closed', to: RCA_LIST_LINKS.open },
  { key: 'overdue', title: 'Overdue investigations', note: 'Open investigations past their due date', to: RCA_LIST_LINKS.overdue },
  { key: 'critical', title: 'Open critical investigations', note: 'Critical priority, not closed', to: RCA_LIST_LINKS.critical },
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

/**
 * RCA tiles of the dashboard: open, overdue and critical investigations and overdue actions (each opening
 * the filtered list), and pending effectiveness checks (server counts, caller's scope).
 */
export function RcaTiles() {
  const query = useRcaSummary();
  const data = query.data;
  const { number } = useNumberFormat();
  return (
    <AnalyticsCard
      title="Investigations and actions"
      testId="dashboard-rca"
      query={query}
      response={undefined}
      actions={
        <Link className="text-sm underline" to={RCA_LIST_LINKS.all}>
          Investigations
        </Link>
      }
    >
      {data && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {TILES.map((tile) => (
            <div key={tile.key} className="rounded-md border p-3" data-testid={`dashboard-rca-${tile.key}`} data-count={data[tile.key]}>
              <dt className="text-xs text-muted-foreground">{tile.title}</dt>
              <dd className="text-xl font-semibold">
                <TileCount tile={tile} count={number(data[tile.key])} />
              </dd>
              <dd className="text-xs text-muted-foreground">{tile.note}</dd>
            </div>
          ))}
        </dl>
      )}
    </AnalyticsCard>
  );
}
