import { useSearchParams } from 'react-router-dom';
import { useRcaPortfolio } from '@/api/v2/queries/rca-portfolio';
import type { RcaPortfolioCauseKind, RcaPortfolioView } from '@/api/v2/types/rca-portfolio';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
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

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function Controls({ filters, onChange }: { filters: PortfolioFilters; onChange: (patch: Partial<PortfolioFilters>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="portfolio-controls">
      <div className="space-y-1">
        <Label htmlFor="portfolio-window">Window</Label>
        <NativeSelect id="portfolio-window" value={String(filters.days)} options={options(WINDOW_LABELS)} onChange={(v) => onChange({ days: Number(v) as WindowDays })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="portfolio-kind">Group by</Label>
        <NativeSelect id="portfolio-kind" value={filters.causeKind} options={options(PORTFOLIO_KIND_LABELS)} onChange={(v) => onChange({ causeKind: v as RcaPortfolioCauseKind })} />
      </div>
      <div className="w-56">
        <UnitSelect id="portfolio-unit" label="Unit" value={filters.unitId} allowAll onChange={(unitId) => onChange({ unitId })} />
      </div>
      {/* one display-currency toggle per screen — the header's (QA re-test N4) */}
    </div>
  );
}

function ReportNote({ report, withMoney }: { report: RcaPortfolioView; withMoney: boolean }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground" data-testid="portfolio-note">
      <p>{report.note}</p>
      {withMoney && report.view && <p>{valueBasisLabel(report.view)}.</p>}
      {withMoney && report.basis && <p data-testid="portfolio-basis">{basisSentence(report.basis)}</p>}
    </div>
  );
}

/**
 * `/reliability/portfolio` (item 2.1): which causes cost most, what is being done about them and whether it
 * worked — the server's rows per coded cause (approved loss, actions, verdicts, claims, realised differences),
 * keyset-paged ("Show more"). Choices live in the URL; money follows the display currency and is left out for
 * roles without it.
 */
export function PortfolioPage() {
  const [params, setParams] = useSearchParams();
  const { currency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  const filters = portfolioFiltersFromParams(params);
  // the rolling window's bounds are minute-stable, so re-renders reuse the cached pages
  const request = portfolioQuery(filters, currency);
  const query = useRcaPortfolio(request);
  const pages = query.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.items);
  const first = pages[0];
  const change = (patch: Partial<PortfolioFilters>) => setParams(paramsFromPortfolioFilters({ ...filters, ...patch }), { replace: true });
  return (
    <Page width="wide">
      <PageHeader title="Cause portfolio" description="Approved loss linked to investigations by coded cause, the actions taken and whether they worked." />
      <Section title="Loss, cause, action and outcome" actions={<Controls filters={filters} onChange={change} />}>
        <DataState
          state={dataStateOf(query, { isEmpty: first !== undefined && rows.length === 0 })}
          detail={first && rows.length === 0 ? 'No investigation was opened in this window.' : undefined}
          error={query.error}
          onRetry={() => void query.refetch()}
        >
          {first && (
            <div className="space-y-2" data-testid="portfolio">
              <ReportNote report={first} withMoney={canViewMoney} />
              <PortfolioTable rows={rows} currency={request.currency ?? 'USD'} withMoney={canViewMoney} />
              {query.hasNextPage && (
                <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} data-testid="portfolio-more">
                  {query.isFetchingNextPage ? 'Loading…' : 'Show more causes'}
                </Button>
              )}
            </div>
          )}
        </DataState>
      </Section>
    </Page>
  );
}
