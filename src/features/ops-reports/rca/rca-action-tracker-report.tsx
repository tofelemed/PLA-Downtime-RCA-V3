import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRcaActionTracker } from '@/api/v2/queries/ops-reports';
import type { CountView } from '@/api/v2/types/ops-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { shareText } from '@/features/pla-analytics/model/display';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';

const AGE_LABELS: Readonly<Record<string, string>> = { '0-30': 'Up to 30 days', '31-60': '31–60 days', '61-90': '61–90 days', '90+': 'Over 90 days' };
const DUE_LABELS: Readonly<Record<string, string>> = { overdue: 'Overdue', due_7_days: 'Due within 7 days', later: 'Due later', no_due_date: 'No due date' };

function Counts({ title, counts, labels, testId }: { title: string; counts: readonly CountView[]; labels?: Readonly<Record<string, string>>; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <ul className="space-y-0.5 text-sm">
        {counts.map((c) => (
          <li key={c.key} className="flex justify-between gap-4">
            <span>{labels?.[c.key] ?? c.key}</span>
            <NumberText value={c.count} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Figure({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{children}</p>
    </div>
  );
}

/**
 * RCA action tracker (R10, continuous-improvement lead, plant manager): the open RCA cases and actions by
 * age, status and due date as of now, and for the chosen dates the actions done on time and the cases
 * closed — the follow-through of root-cause work. Claimed and realised savings: the cause portfolio.
 */
export function RcaActionTrackerReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useRcaActionTracker(scopeBase(scope), env.timezone);
  const data = query.data;
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {data && (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="rca-action-tracker">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Figure label="Open cases" testId="rca-open-cases"><NumberText value={data.openCases.total} /></Figure>
                <Figure label="Cases past target date" testId="rca-overdue-cases"><NumberText value={data.openCases.overdue} /></Figure>
                <Figure label="Open actions" testId="rca-open-actions"><NumberText value={data.openActions.total} /></Figure>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Counts title="Cases by age" counts={data.openCases.byAge} labels={AGE_LABELS} testId="rca-cases-age" />
                <Counts title="Cases by status" counts={data.openCases.byStatus} testId="rca-cases-status" />
                <Counts title="Actions by due date" counts={data.openActions.byDue} labels={DUE_LABELS} testId="rca-actions-due" />
                <Counts title="Actions by age" counts={data.openActions.byAge} labels={AGE_LABELS} testId="rca-actions-age" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Closed on these dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Figure label="Actions done" testId="rca-actions-done"><NumberText value={data.closedActions.done} /></Figure>
                <Figure label="Done on time (of those with a due date)" testId="rca-on-time">
                  <LocalizedNumber text={shareText(data.closedActions.onTimeRate)} />
                </Figure>
                <Figure label="Cases closed" testId="rca-cases-closed"><NumberText value={data.closedCases.closed} /></Figure>
                <Figure label="Mean days to close" testId="rca-days-to-close"><NumberText value={data.closedCases.meanDaysToClose} fractionDigits={1} /></Figure>
              </div>
              <p className="text-xs text-muted-foreground">
                Late actions: <NumberText value={data.closedActions.late} /> of <NumberText value={data.closedActions.withDueDate} /> with a due date. Savings claimed and realised are in the{' '}
                <Link className="underline" to="/reliability/portfolio">cause portfolio</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </DataState>
  );
}
