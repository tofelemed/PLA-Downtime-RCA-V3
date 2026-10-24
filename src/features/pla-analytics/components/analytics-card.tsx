import { useContext, type ReactNode } from 'react';
import { AnalysisSnapshotContext } from '@/features/analysis-navigation/analysis-snapshot-context';
import { ReportCard, type CardDataAttributes } from './report-card';
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
  /** a label the figures need (scope or cohort note); not shown inside `ReportChrome` (Reports, PLA pages) */
  note?: ReactNode;
  /** what an operator needs to read the figures, behind an ⓘ beside the title */
  info?: ReactNode;
  actions?: ReactNode;
  /** `data-*` attributes of the card element (e.g. the units and runs end-to-end tests read) */
  attributes?: CardDataAttributes;
  /** the rows or figures carry their own "Provisional" markers, so none beside the title */
  provisionalRows?: boolean;
  children: ReactNode;
}

/**
 * One analytics widget: title, its own loading / empty / error state and the figures. The page-wide facts
 * (incomplete coverage, calculation runs, policy versions) are said once in the page header (UI guidelines
 * §2 "say it once"); the card carries at most a "Provisional" chip. While a new scope loads the previous
 * figures stay, under a thin refreshing bar. On the Reports page and the PLA analysis pages (`ReportChrome`)
 * it is a `ReportCard`: the title and ⓘ only (no chip or caption), and with Revision = Provisional one marker
 * beside the title when the response is provisional and its rows do not say so themselves. On the PLA pages
 * (`AnalysisSnapshotContext`) the card also says when its data is incomplete, with the runs behind "Details".
 */
export function AnalyticsCard(props: AnalyticsCardProps) {
  const report = useReportChrome();
  return report ? <ReportAnalyticsCard {...props} /> : <PlainAnalyticsCard {...props} />;
}

const isRefreshing = (query: AnalyticsCardProps['query']) => Boolean(query.isPlaceholderData || (query.isFetching && !query.isLoading));

function ReportAnalyticsCard(props: AnalyticsCardProps) {
  const { testId, query, response, info, actions, attributes, provisionalRows } = props;
  const title = reportText(props.title);
  const refreshing = isRefreshing(query);
  return (
    <ReportCard title={title} testId={testId} info={info} actions={actions} attributes={attributes} provisional={!provisionalRows && response?.isProvisional === true} aria-busy={refreshing || undefined}>
      <CardBody {...props} refreshing={refreshing} lead={<CalculationDetails response={response} approvedOnly={props.approvedOnly} />} />
    </ReportCard>
  );
}

function PlainAnalyticsCard(props: AnalyticsCardProps) {
  const { title, testId, query, response, note, info, actions, attributes, approvedOnly = false } = props;
  const refreshing = isRefreshing(query);
  return (
    <Card data-testid={testId} aria-busy={refreshing || undefined} {...attributes}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {info && <KpiInfo label={title} text={info} />}
          {shownAsProvisional(response, approvedOnly) && <Badge variant="secondary">Provisional</Badge>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="relative space-y-2">
        <CardBody
          {...props}
          refreshing={refreshing}
          lead={
            <>
              <CalculationDetails response={response} approvedOnly={approvedOnly} />
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </>
          }
        />
      </CardContent>
    </Card>
  );
}

/** The refreshing bar, what the card says above the figures (`lead`), then the figures or their state. */
function CardBody({ query, isEmpty, emptyText, children, refreshing, lead }: AnalyticsCardProps & { refreshing: boolean; lead?: ReactNode }) {
  const state = dataStateOf(query, { isEmpty });
  return (
    <>
      {refreshing && <div className="absolute inset-x-6 top-0 h-0.5 animate-pulse bg-primary/60" role="status" aria-label="Refreshing" />}
      {lead}
      <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail={state === 'empty' ? emptyText : undefined}>
        {children}
      </DataState>
    </>
  );
}

function hasSnapshot(response: Pick<AnalyticsResponse<unknown>, 'isProvisional'>): response is AnalyticsResponse<{ calculationRunIds: string[] }> {
  return 'data' in response && 'coverage' in response && 'dataQuality' in response && 'asOf' in response;
}

/**
 * PLA analysis pages (`AnalysisSnapshotContext` set): the incomplete-data note and the runs / policies behind
 * "Details". Not on the Reports page and not on the PLA overview, whose header says it once for the page.
 */
function CalculationDetails({ response, approvedOnly }: Pick<AnalyticsCardProps, 'response' | 'approvedOnly'>) {
  const scope = useContext(AnalysisSnapshotContext);
  if (!scope || !response || !hasSnapshot(response)) return null;
  return <SnapshotStatus response={response} approvedOnly={approvedOnly} timezone={scope.timezone} />;
}
