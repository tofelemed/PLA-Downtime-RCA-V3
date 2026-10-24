import { useId, type ReactNode } from 'react';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';
import { policyVersionsLabel } from '@/features/ux-kit/labels';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { StatusIcon } from '@/lib/icons';
import { formatRatio, INCOMPLETE_TEXT } from '../model/kpi-display';
import { FigureStatus } from './figure-status';

type RunResponse = AnalyticsResponse<{ calculationRunIds: string[] }>;

/** The card's label carries provisional figures once: rows get no marker of their own. */
const CARD_LOOK: ReportLook = { provisional: false };

/** What a figure states about itself (UX03): approval as the label; runs, coverage and policy versions behind its ⓘ. */
export function ReportMeta({ response }: { response: RunResponse }) {
  const { digits, number } = useNumberFormat();
  const runs = response.data.calculationRunIds.length;
  const parts = [
    `Coverage ${formatRatio(String(response.coverage.ratio), 0, digits)}`,
    runs === 1 ? `${number(1)} calculation run` : `${number(runs)} calculation runs`,
    ...(response.policyVersion ? [policyVersionsLabel(response.policyVersion)] : []),
  ];
  return <FigureStatus provisional={response.isProvisional} info={parts.join(' · ')} testId="report-meta" data={{ 'data-run-count': runs }} />;
}

/**
 * A card's own empty result (e.g. no losses in the window: a real, good result) in the centred report empty
 * style, without the generic "try other dates" hint; cards without a message keep the shared empty state.
 */
function CardEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" data-state="empty" data-testid="card-empty">
      <StatusIcon.empty aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">{text}</p>
    </div>
  );
}

export interface ReportCardProps {
  title: string;
  testId: string;
  query: QueryLike & { refetch: () => unknown };
  response: RunResponse | undefined;
  isEmpty?: boolean;
  /** the card's own empty message (shown instead of the generic "No data for these dates") */
  emptyText?: string;
  /** what the figures mean, behind the ⓘ beside the title */
  info?: ReactNode;
  /** a row under the title the figures need (e.g. the reason level breadcrumb) */
  note?: ReactNode;
  actions?: ReactNode;
  /** false for widgets of the page snapshot: their runs and approval are stated once in the page header */
  showMeta?: boolean;
  children: ReactNode;
}

/**
 * A report card (`rounded-lg border bg-card p-4`): h2 title with its ⓘ and — for reads outside the page
 * snapshot — the Provisional / Approved label, actions right, then the UX03 state of its query (incomplete
 * when periods lack a run) around the figures, in the shared compact report table look.
 */
export function ReportCard(props: ReportCardProps) {
  const { title, testId, response, info, note, actions, showMeta = true } = props;
  const headingId = useId();
  return (
    <ReportLookContext.Provider value={CARD_LOOK}>
      <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {info && <KpiInfo label={title} text={info} />}
            {response && showMeta && <ReportMeta response={response} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {note}
        <div data-testid={testId} className="space-y-2">
          <CardBody {...props} />
        </div>
      </section>
    </ReportLookContext.Provider>
  );
}

/** The UX03 state of the card's query (incomplete when periods lack a run) around the figures; the card's own empty message when it has one. */
function CardBody({ query, response, isEmpty, emptyText, children }: ReportCardProps) {
  const incomplete = response ? response.coverage.ratio < 1 || response.dataQuality.missingCount > 0 : false;
  const state = dataStateOf(query, { isEmpty, isIncomplete: incomplete });
  if (state === 'empty' && emptyText) return <CardEmpty text={emptyText} />;
  return (
    <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail={state === 'incomplete' ? INCOMPLETE_TEXT : undefined}>
      {children}
    </DataState>
  );
}
