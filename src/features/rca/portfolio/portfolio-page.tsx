import { useSearchParams } from 'react-router-dom';
import { useRcaPortfolio } from '@/api/v2/queries/rca-portfolio';
import type { RcaPortfolioCauseKind, RcaPortfolioView } from '@/api/v2/types/rca-portfolio';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { RELIABILITY_LOOK } from '../components/reliability-look';
import { SelectField } from '../components/select-field';
import { UnitField } from '../components/unit-field';
import {
  paramsFromPortfolioFilters,
  PORTFOLIO_KIND_LABELS,
  portfolioFiltersFromParams,
  portfolioQuery,
  WINDOW_LABELS,
  type PortfolioFilters,
  type WindowDays,
} from './portfolio-model';
import { PortfolioTable } from './portfolio-table';

const TITLE = 'Loss, cause, action and outcome';
const EMPTY_TEXT = 'No investigation was opened in this window.';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** One bottom-aligned row, labels above, h-9 controls: Unit, what is grouped, then the window (one display-currency toggle per screen — the header's, QA re-test N4). */
function Controls({ filters, onChange }: { filters: PortfolioFilters; onChange: (patch: Partial<PortfolioFilters>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label="Cause portfolio filters" data-testid="portfolio-controls">
      <UnitField id="portfolio-unit" value={filters.unitId} onChange={(unitId) => onChange({ unitId })} />
      <SelectField id="portfolio-kind" label="Group by" value={filters.causeKind} options={options(PORTFOLIO_KIND_LABELS)} onChange={(v) => onChange({ causeKind: v as RcaPortfolioCauseKind })} />
      <SelectField id="portfolio-window" label="Investigations opened" value={String(filters.days)} options={options(WINDOW_LABELS)} onChange={(v) => onChange({ days: Number(v) as WindowDays })} />
    </div>
  );
}

/** The server's note on the separate figures and the value basis, behind the card ⓘ. */
function ReportInfo({ report, withMoney }: { report: RcaPortfolioView; withMoney: boolean }) {
  return (
    <span className="flex flex-col gap-1" data-testid="portfolio-note">
      <span>{report.note}</span>
      {withMoney && report.view && <span>{valueBasisLabel(report.view)}.</span>}
      {withMoney && report.basis && <span data-testid="portfolio-basis">{basisSentence(report.basis)}</span>}
    </span>
  );
}

/**
 * `/reliability/portfolio` (item 2.1): which causes cost most, what is being done about them and whether it
 * worked — the server's rows per coded cause (approved loss, actions, verdicts, claims, realised differences),
 * keyset-paged ("Show more"). Choices live in the URL; money follows the display currency and is left out for
 * roles without it. Title only, one filter row and one report card (cleanup 24 Oct 2026); the count shows
 * once every page is loaded, the server's note is behind the card ⓘ.
 */
export function PortfolioPage() {
  const [params, setParams] = useSearchParams();
  const { currency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  const { number } = useNumberFormat();
  const filters = portfolioFiltersFromParams(params);
  // the rolling window's bounds are minute-stable, so re-renders reuse the cached pages
  const request = portfolioQuery(filters, currency);
  const query = useRcaPortfolio(request);
  const pages = query.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.items);
  const first = pages[0];
  const change = (patch: Partial<PortfolioFilters>) => setParams(paramsFromPortfolioFilters({ ...filters, ...patch }), { replace: true });
  const count = first && !query.hasNextPage ? <span className="text-sm text-muted-foreground" data-testid="portfolio-count">({number(rows.length)})</span> : undefined;
  return (
    <Page width="wide">
      <div className="space-y-5">
        <PageHeader title="Cause portfolio" />
        <Controls filters={filters} onChange={change} />
        <ReportLookContext.Provider value={RELIABILITY_LOOK}>
          <ReportCard title={TITLE} info={first ? <ReportInfo report={first} withMoney={canViewMoney} /> : undefined} badge={count}>
            <DataState
              state={dataStateOf(query, { isEmpty: first !== undefined && rows.length === 0 })}
              detail={first && rows.length === 0 ? EMPTY_TEXT : undefined}
              error={query.error}
              onRetry={() => void query.refetch()}
            >
              {first && (
                <div className="space-y-2" data-testid="portfolio">
                  <PortfolioTable rows={rows} currency={request.currency ?? 'USD'} withMoney={canViewMoney} />
                  {query.hasNextPage && (
                    <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} data-testid="portfolio-more">
                      {query.isFetchingNextPage ? 'Loading…' : 'Show more causes'}
                    </Button>
                  )}
                </div>
              )}
            </DataState>
          </ReportCard>
        </ReportLookContext.Provider>
      </div>
    </Page>
  );
}
