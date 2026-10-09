import type { ReactNode } from 'react';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';
import { formatRatio } from '../model/kpi-display';

/** What every widget states about its numbers (UX03): runs behind them, approval, coverage, policy. */
export function ReportMeta({ response }: { response: AnalyticsResponse<{ calculationRunIds: string[] }> }) {
  const runs = response.data.calculationRunIds.length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="report-meta" data-run-count={runs}>
      <Badge variant={response.isProvisional ? 'secondary' : 'default'}>{response.isProvisional ? 'Provisional' : 'Approved'}</Badge>
      <span>{runs === 1 ? '1 calculation run' : `${runs} calculation runs`}</span>
      <span>Coverage {formatRatio(String(response.coverage.ratio), 0)}</span>
      {response.policyVersion && <span>Policy {response.policyVersion}</span>}
    </div>
  );
}

export interface ReportCardProps {
  title: string;
  testId: string;
  query: QueryLike & { refetch: () => unknown };
  response: AnalyticsResponse<{ calculationRunIds: string[] }> | undefined;
  isEmpty?: boolean;
  emptyText?: string;
  /** a label the figures need (scope or cohort note) */
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A report widget: title, the UX03 state of its query (incomplete when periods lack a run), the
 * figures, and the run / approval / coverage line of its own response.
 */
export function ReportCard(props: ReportCardProps) {
  const { title, testId, query, response, isEmpty, emptyText, note, actions, children } = props;
  const incomplete = response ? response.coverage.ratio < 1 || response.dataQuality.missingCount > 0 : false;
  const state = dataStateOf(query, { isEmpty, isIncomplete: incomplete });
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="space-y-2">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <DataState
          state={state}
          error={query.error}
          onRetry={() => query.refetch()}
          detail={state === 'empty' ? emptyText : state === 'incomplete' ? 'Only calculated periods are counted.' : undefined}
        >
          {children}
        </DataState>
        {response && <ReportMeta response={response} />}
      </CardContent>
    </Card>
  );
}
