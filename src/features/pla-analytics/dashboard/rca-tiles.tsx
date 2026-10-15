import { Link } from 'react-router-dom';
import { useRcaSummary } from '@/api/v2/queries/rca-cases';
import type { RcaCaseSummaryCounts } from '@/api/v2/types/rca';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { AnalyticsCard } from '../components/analytics-card';

interface RcaTile {
  key: keyof Pick<RcaCaseSummaryCounts, 'open' | 'overdueActions' | 'effectivenessPending'>;
  title: string;
  note: string;
}

const TILES: readonly RcaTile[] = [
  { key: 'open', title: 'Open RCA cases', note: 'Cases not closed' },
  { key: 'overdueActions', title: 'Overdue actions', note: 'Open or in-progress actions past their due date' },
  { key: 'effectivenessPending', title: 'Effectiveness pending', note: 'Actions waiting for their effectiveness result' },
];

/** RCA tiles of the dashboard: open cases, overdue actions and pending effectiveness checks (server counts, caller's scope). */
export function RcaTiles() {
  const query = useRcaSummary();
  const data = query.data;
  const { number } = useNumberFormat();
  return (
    <AnalyticsCard
      title="Root cause analysis"
      testId="dashboard-rca"
      query={query}
      response={undefined}
      actions={
        <Link className="text-sm underline" to="/rca">
          RCA cases
        </Link>
      }
    >
      {data && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TILES.map((tile) => (
            <div key={tile.key} className="rounded-md border p-3" data-testid={`dashboard-rca-${tile.key}`} data-count={data[tile.key]}>
              <dt className="text-xs text-muted-foreground">{tile.title}</dt>
              <dd className="text-xl font-semibold">{number(data[tile.key])}</dd>
              <dd className="text-[11px] text-muted-foreground">{tile.note}</dd>
            </div>
          ))}
        </dl>
      )}
    </AnalyticsCard>
  );
}
