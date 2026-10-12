import type { ReactNode } from 'react';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';
import { policyVersionsLabel } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { formatRatio } from '../model/kpi-display';

type RunResponse = AnalyticsResponse<{ calculationRunIds: string[] }>;

/** What a figure states about itself (UX03): approval, runs and coverage, policy versions behind "Details". */
export function ReportMeta({ response }: { response: RunResponse }) {
  const runs = response.data.calculationRunIds.length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="report-meta" data-run-count={runs}>
      <Badge variant={response.isProvisional ? 'secondary' : 'default'}>{response.isProvisional ? 'Provisional' : 'Approved'}</Badge>
      <span>Coverage {formatRatio(String(response.coverage.ratio), 0)}</span>
      <details className="inline">
        <summary className="cursor-pointer">Details</summary>
        <span>
          {runs === 1 ? '1 calculation run' : `${runs} calculation runs`}
          {response.policyVersion ? ` · ${policyVersionsLabel(response.policyVersion)}` : ''}
        </span>
      </details>
    </div>
  );
}

export interface ReportCardProps {
  title: string;
  testId: string;
  query: QueryLike & { refetch: () => unknown };
  response: RunResponse | undefined;
  isEmpty?: boolean;
  emptyText?: string;
  /** a label the figures need (scope or cohort note) */
  note?: ReactNode;
  actions?: ReactNode;
  /** false for widgets of the page snapshot: their runs and approval are stated once in the page header */
  showMeta?: boolean;
  children: ReactNode;
}

/**
 * A report section: title, the UX03 state of its query (incomplete when periods lack a run), the
 * figures, and — for reads outside the page snapshot — the approval / coverage line of its response.
 */
export function ReportCard(props: ReportCardProps) {
  const { title, testId, query, response, isEmpty, emptyText, note, actions, showMeta = true, children } = props;
  const incomplete = response ? response.coverage.ratio < 1 || response.dataQuality.missingCount > 0 : false;
  const state = dataStateOf(query, { isEmpty, isIncomplete: incomplete });
  return (
    <Section title={title} actions={actions} description={note} className="rounded-md border p-4">
      <div data-testid={testId} className="space-y-2">
        <DataState
          state={state}
          error={query.error}
          onRetry={() => query.refetch()}
          detail={state === 'empty' ? emptyText : state === 'incomplete' ? 'Only calculated periods are counted.' : undefined}
        >
          {children}
        </DataState>
        {response && showMeta && <ReportMeta response={response} />}
      </div>
    </Section>
  );
}
