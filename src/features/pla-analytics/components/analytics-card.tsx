import { useContext, type ReactNode } from 'react';
import { AnalysisSnapshotContext } from '@/features/analysis-navigation/analysis-snapshot-context';
import { SnapshotStatus } from './snapshot-status';
import { useReportChrome } from './use-report-chrome';
import { KpiInfo } from '../dashboard/kpi-info';
import { reportText } from '../model/report-text';
import { shownAsProvisional } from '../model/provisional';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';

export interface AnalyticsCardProps {
  title: string;
  testId: string;
  query: QueryLike & { refetch: () => unknown; isFetching?: boolean; isPlaceholderData?: boolean };
  response: (Pick<AnalyticsResponse<unknown>, 'isProvisional'> & Partial<Pick<AnalyticsResponse<unknown>, 'coverage'>>) | undefined;
  /** the scope shows approved revisions only: missing periods are incomplete, not "Provisional" (same rule as the header) */
  approvedOnly?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  /** a label the figures need (scope or cohort note); not shown on the Reports page */
  note?: ReactNode;
  /** what an operator needs to read the figures, behind an ⓘ beside the title */
  info?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * One analytics widget: title, its own loading / empty / error state and the figures. The page-wide facts
 * (incomplete coverage, calculation runs, policy versions) are said once in the page header (UI guidelines
 * §2 "say it once"); the card carries at most a "Provisional" chip. While a new scope loads the previous
 * figures stay, under a thin refreshing bar. On the Reports page (`ReportChrome`) the card shows its title
 * and ⓘ only: no chip, caption or calculation details.
 */
export function AnalyticsCard(props: AnalyticsCardProps) {
  const { testId, query, response, isEmpty, emptyText, info, actions, children } = props;
  const { report, title, note, provisional } = useCardChrome(props);
  const state = dataStateOf(query, { isEmpty });
  const refreshing = Boolean(query.isPlaceholderData || (query.isFetching && !query.isLoading));
  return (
    <Card data-testid={testId} aria-busy={refreshing || undefined}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {info && <KpiInfo label={title} text={info} />}
          {provisional && <Badge variant="secondary">Provisional</Badge>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="relative space-y-2">
        {refreshing && <div className="absolute inset-x-6 top-0 h-0.5 animate-pulse bg-primary/60" role="status" aria-label="Refreshing" />}
        {!report && <CalculationDetails response={response} />}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail={state === 'empty' ? emptyText : undefined}>
          {children}
        </DataState>
      </CardContent>
    </Card>
  );
}

/** What the card says around its figures: everything elsewhere, the title alone on the Reports page. */
function useCardChrome({ title, note, response, approvedOnly = false }: AnalyticsCardProps) {
  const report = useReportChrome();
  if (report) return { report, title: reportText(title), note: undefined, provisional: false };
  return { report, title, note, provisional: shownAsProvisional(response, approvedOnly) };
}

function hasSnapshot(response: Pick<AnalyticsResponse<unknown>, 'isProvisional'>): response is AnalyticsResponse<{ calculationRunIds: string[] }> {
  return 'data' in response && 'coverage' in response && 'dataQuality' in response && 'asOf' in response;
}

function CalculationDetails({ response }: Pick<AnalyticsCardProps, 'response'>) {
  const scope = useContext(AnalysisSnapshotContext);
  if (!scope || !response || !hasSnapshot(response)) return null;
  return <details><summary className="cursor-pointer text-xs text-primary">Calculation details</summary><SnapshotStatus {...scope} response={response} /></details>;
}
