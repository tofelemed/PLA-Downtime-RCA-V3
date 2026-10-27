import { Link, useSearchParams } from 'react-router-dom';
import { useLossStatement, type LossStatementPage } from '@/api/v2/queries/loss-statement';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { LossAccountingStatement } from '@/features/plan-dashboard/components/loss-accounting-statement';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { plural } from '@/features/ux-kit/format/plural';
import { ReportCard } from '../components/report-card';
import { exportBlockedReason, type AnalyticsScope } from '../model/analytics-scope';
import { backEventOf, statementQuery } from '../model/statement-page';
import { StatementExport } from './statement-export';
import { StatementTable } from './statement-table';

const TOTAL_INFO =
  'The production accounting of the selected units and dates as one statement: planned, actual, the shortfall and how it is explained — losses by kind, the recovery that offsets them and what nobody has explained yet. The server adds up the periods; approved revisions only with "Approved only", else drafts too (provisional).';

function TotalNotes({ first }: { first: LossStatementPage }) {
  const { incomplete } = first.data;
  const mixed = first.dataQuality.notes?.includes('uom_mixed') ?? false;
  return (
    <>
      {incomplete > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="statement-incomplete">
          {`${plural(incomplete, 'period is', 'periods are')} not in the total: no approved revision in this selection, or no calculation, target or actuals yet.`}
        </p>
      )}
      {mixed && <p className="text-xs text-warning">The selected units report in different units of measure, so no total is shown; see each period below.</p>}
    </>
  );
}

function BackToEvent() {
  const [params] = useSearchParams();
  const eventId = backEventOf(params);
  if (!eventId) return null;
  return (
    <Link to={`/events/${eventId}`} className="text-sm font-medium text-primary hover:underline" data-testid="statement-back-to-event">
      ← Back to the event
    </Link>
  );
}

/**
 * PLA "Accounting statement" (Task 13 addendum, owner 27 Oct 2026): the statement of the section's units and
 * window on top, then the keyset-paged rows (a day, or its shifts) that expand to their statement and open
 * the period. `focus=<periodId>` expands and scrolls to a row; `source=event:<id>` links back to the event.
 */
export function StatementPage({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const query = statementQuery(scope);
  const report = useLossStatement(query, env.timezone);
  const pages = report.data?.pages ?? [];
  const first = pages[0];
  const rows = pages.flatMap((page) => page.data.items);
  const provisional = pages.some((page) => page.isProvisional);
  const state = dataStateOf(report);
  const exportReason = exportBlockedReason(scope, provisional, 'Approved only');
  return (
    <div className="space-y-4" data-testid="pla-statement-page">
      <BackToEvent />
      <ReportCard title="Accounting statement" testId="statement-total" info={TOTAL_INFO} provisional={provisional} actions={<StatementExport query={query} blockedReason={exportReason} timezone={env.timezone} />}>
        <DataState state={state} error={report.error} onRetry={() => void report.refetch()}>
          {first && (
            <div className="space-y-2">
              {first.data.total ? <LossAccountingStatement statement={first.data.total} /> : <p className="text-sm text-muted-foreground">No complete period to state in this selection.</p>}
              <TotalNotes first={first} />
            </div>
          )}
        </DataState>
      </ReportCard>
      <ReportCard title="Per day" testId="statement-rows" info="One row per day (per shift when the plant accounts by shift, grouped under the day). Open a row for its full statement and the period page.">
        <DataState state={state} error={report.error} onRetry={() => void report.refetch()}>
          <StatementTable key={focus ?? ''} rows={rows} focus={focus} hasMore={report.hasNextPage} loadingMore={report.isFetchingNextPage} onMore={() => void report.fetchNextPage()} />
        </DataState>
      </ReportCard>
    </div>
  );
}
