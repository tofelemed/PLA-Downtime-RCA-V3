import { useContext, type ReactNode } from 'react';
import { AnalysisSnapshotContext } from '@/features/analysis-navigation/analysis-snapshot-context';
import { SnapshotStatus } from './snapshot-status';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';

export interface AnalyticsCardProps {
  title: string;
  testId: string;
  query: QueryLike & { refetch: () => unknown; isFetching?: boolean; isPlaceholderData?: boolean };
  response: Pick<AnalyticsResponse<unknown>, 'isProvisional'> | undefined;
  isEmpty?: boolean;
  emptyText?: string;
  /** a label the figures need (scope or cohort note) */
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * One analytics widget: title, its own loading / empty / error state and the figures. The page-wide facts
 * (incomplete coverage, calculation runs, policy versions) are said once in the page header (UI guidelines
 * §2 "say it once"); the card carries at most a "Provisional" chip. While a new scope loads the previous
 * figures stay, under a thin refreshing bar.
 */
export function AnalyticsCard(props: AnalyticsCardProps) {
  const { title, testId, query, response, isEmpty, emptyText, note, actions, children } = props;
  const state = dataStateOf(query, { isEmpty });
  const refreshing = Boolean(query.isPlaceholderData || (query.isFetching && !query.isLoading));
  return (
    <Card data-testid={testId} aria-busy={refreshing || undefined}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {response?.isProvisional && <Badge variant="secondary">Provisional</Badge>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="relative space-y-2">
        {refreshing && <div className="absolute inset-x-6 top-0 h-0.5 animate-pulse bg-primary/60" role="status" aria-label="Refreshing" />}
        <CalculationDetails response={response} />
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail={state === 'empty' ? emptyText : undefined}>
          {children}
        </DataState>
      </CardContent>
    </Card>
  );
}

function hasSnapshot(response: Pick<AnalyticsResponse<unknown>, 'isProvisional'>): response is AnalyticsResponse<{ calculationRunIds: string[] }> {
  return 'data' in response && 'coverage' in response && 'dataQuality' in response && 'asOf' in response;
}

function CalculationDetails({ response }: Pick<AnalyticsCardProps, 'response'>) {
  const scope = useContext(AnalysisSnapshotContext);
  if (!scope || !response || !hasSnapshot(response)) return null;
  return <details><summary className="cursor-pointer text-xs text-primary">Calculation details</summary><SnapshotStatus {...scope} response={response} /></details>;
}
