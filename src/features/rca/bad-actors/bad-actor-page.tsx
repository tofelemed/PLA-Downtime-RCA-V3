import { useSearchParams } from 'react-router-dom';
import { useBadActorReport } from '@/api/v2/queries/bad-actors';
import type { BadActorReportView } from '@/api/v2/types/bad-actors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import {
  badActorQuery,
  currentPlantMonth,
  filtersFromParams,
  GROUP_LABELS,
  LIMITS,
  paramsFromFilters,
  RANK_LABELS,
  VIEW_LABELS,
  type BadActorFilters,
} from './bad-actor-model';
import { BadActorTable } from './bad-actor-table';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function Controls({ filters, onChange }: { filters: BadActorFilters; onChange: (patch: Partial<BadActorFilters>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="bad-actor-controls">
      <div className="space-y-1">
        <Label htmlFor="bad-actor-month">Review month</Label>
        <Input id="bad-actor-month" type="month" value={filters.month} onChange={(e) => e.target.value && onChange({ month: e.target.value })} className="w-44" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bad-actor-group">Group by</Label>
        <NativeSelect id="bad-actor-group" value={filters.groupBy} options={options(GROUP_LABELS)} onChange={(v) => onChange({ groupBy: v as BadActorFilters['groupBy'] })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bad-actor-rank">Rank by</Label>
        <NativeSelect id="bad-actor-rank" value={filters.rankBy} options={options(RANK_LABELS)} onChange={(v) => onChange({ rankBy: v as BadActorFilters['rankBy'] })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bad-actor-limit">Top</Label>
        <NativeSelect id="bad-actor-limit" value={String(filters.limit)} options={LIMITS.map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => onChange({ limit: Number(v) })} />
      </div>
      <DisplayCurrencyToggle />
    </div>
  );
}

function ReportNote({ report }: { report: BadActorReportView }) {
  const dates = usePlantDates();
  return (
    <p className="text-xs text-muted-foreground" data-testid="bad-actor-window">
      Rolling {report.windowDays} days: {dates.validity(report.from, report.to)} (plant time). Value: {VIEW_LABELS[report.view] ?? report.view}
      {report.valuationStatus === 'provisional' ? `; ${report.periods - report.approvedPeriods} of ${report.periods} periods not approved yet, so their loss is not included` : ''}. {report.basis}.
    </p>
  );
}

/**
 * `/reliability/bad-actors` (CA8, SME 14 Oct 2026): the monthly review of the top assets or asset failure
 * modes over the RCA policy's rolling window, ranked on the server by approved loss, approved value or
 * stops, with each asset's cumulative bad-actor trigger state. Choices live in the URL.
 */
export function BadActorPage() {
  const [params, setParams] = useSearchParams();
  const dates = usePlantDates();
  const { currency } = useDisplayCurrency();
  const filters = filtersFromParams(params, currentPlantMonth(dates.timezone));
  const query = useBadActorReport(badActorQuery(filters, currency));
  const report = query.data?.data;
  const change = (patch: Partial<BadActorFilters>) => setParams(paramsFromFilters({ ...filters, ...patch }), { replace: true });
  return (
    <Page width="wide">
      <PageHeader title="Bad actors" description="Monthly review of the assets and failure modes that lose the most (CA8)." />
      <Section title="Top bad actors" actions={<Controls filters={filters} onChange={change} />}>
        <DataState state={dataStateOf(query, { isEmpty: report !== undefined && report.items.length === 0 })} error={query.error} onRetry={() => void query.refetch()}>
          {report && (
            <div className="space-y-2" data-testid="bad-actor-report" data-rank-by={report.rankBy}>
              <ReportNote report={report} />
              <BadActorTable report={report} />
            </div>
          )}
        </DataState>
      </Section>
    </Page>
  );
}
