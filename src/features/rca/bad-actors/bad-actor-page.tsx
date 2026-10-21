import { NumberText } from '@/features/ux-kit/number-text';
import { useSearchParams } from 'react-router-dom';
import { useBadActorReport } from '@/api/v2/queries/bad-actors';
import type { BadActorReportView } from '@/api/v2/types/bad-actors';
import { Label } from '@/components/ui/label';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataState } from '@/features/ux-kit/data-state';
import { PlantMonthInput } from '@/features/ux-kit/date-inputs/plant-month-input';
import { useCalendarPreference } from '@/lib/dates';
import { currentPlantMonth } from '@/lib/dates';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import {
  badActorQuery,
  excludedPeriodsNote,
  filtersFromParams,
  GROUP_LABELS,
  LIMITS,
  paramsFromFilters,
  RANK_LABELS,
  reviewWindowDates,
  type BadActorFilters,
} from './bad-actor-model';
import { BadActorTable } from './bad-actor-table';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface ControlsProps {
  filters: BadActorFilters;
  latestMonth: string;
  onChange: (patch: Partial<BadActorFilters>) => void;
}

function Controls({ filters, latestMonth, onChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="bad-actor-controls">
      <div className="space-y-1">
        <Label htmlFor="bad-actor-month">Review month</Label>
        <PlantMonthInput id="bad-actor-month" value={filters.month} latest={latestMonth} onChange={(month) => onChange({ month })} />
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
      {/* QA re-test N4: one display-currency toggle per screen — the header's */}
    </div>
  );
}

function ReportNote({ report }: { report: BadActorReportView }) {
  const dates = usePlantDates();
  const preference = useCalendarPreference();
  const excluded = excludedPeriodsNote(report);
  return (
    <div className="space-y-1 text-xs text-muted-foreground" data-testid="bad-actor-window">
      <p>
        Rolling <NumberText value={report.windowDays} /> days: {reviewWindowDates(report, { timeZone: dates.timezone, ...preference })} (plant dates, both included). {valueBasisLabel(report.view)}
        {excluded ? `; ${excluded}` : ''}.
      </p>
      <p data-testid="bad-actor-basis">{basisSentence(report.basis)}</p>
    </div>
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
  const { calendar } = useCalendarPreference();
  const latestMonth = currentPlantMonth(dates.timezone, calendar);
  const filters = filtersFromParams(params, latestMonth);
  const query = useBadActorReport(badActorQuery(filters, currency));
  const report = query.data?.data;
  const change = (patch: Partial<BadActorFilters>) => setParams(paramsFromFilters({ ...filters, ...patch }), { replace: true });
  return (
    <Page width="wide">
      <PageHeader title="Bad actors" description="Monthly review of the assets and failure modes that lose the most." />
      <Section title="Top bad actors" actions={<Controls filters={filters} latestMonth={latestMonth} onChange={change} />}>
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
