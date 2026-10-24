import { NumberText } from '@/features/ux-kit/number-text';
import { useSearchParams } from 'react-router-dom';
import { useBadActorReport } from '@/api/v2/queries/bad-actors';
import type { BadActorReportView } from '@/api/v2/types/bad-actors';
import { Label } from '@/components/ui/label';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { DataState } from '@/features/ux-kit/data-state';
import { PlantMonthInput } from '@/features/ux-kit/date-inputs/plant-month-input';
import { useCalendarPreference } from '@/lib/dates';
import { currentPlantMonth } from '@/lib/dates';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { RELIABILITY_LOOK } from '../components/reliability-look';
import { SelectField } from '../components/select-field';
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

const TITLE = 'Top bad actors';
const EMPTY_TEXT = 'No approved loss or stops in this window.';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface ControlsProps {
  filters: BadActorFilters;
  latestMonth: string;
  onChange: (patch: Partial<BadActorFilters>) => void;
}

/** One bottom-aligned row, labels above, h-9 controls: what is ranked, then the review month (one display-currency toggle per screen — the header's, QA re-test N4). */
function Controls({ filters, latestMonth, onChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label="Bad actor filters" data-testid="bad-actor-controls">
      <SelectField id="bad-actor-group" label="Group by" value={filters.groupBy} options={options(GROUP_LABELS)} onChange={(v) => onChange({ groupBy: v as BadActorFilters['groupBy'] })} />
      <SelectField id="bad-actor-rank" label="Rank by" value={filters.rankBy} options={options(RANK_LABELS)} onChange={(v) => onChange({ rankBy: v as BadActorFilters['rankBy'] })} />
      <SelectField id="bad-actor-limit" label="Top" value={String(filters.limit)} options={LIMITS.map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => onChange({ limit: Number(v) })} />
      <div className={FIELD_CLASS}>
        <Label htmlFor="bad-actor-month">Review month</Label>
        <PlantMonthInput id="bad-actor-month" value={filters.month} latest={latestMonth} onChange={(month) => onChange({ month })} />
      </div>
    </div>
  );
}

/** What the figures cover, behind the card ⓘ: the rolling window, the value basis and the server's basis sentence. */
function ReportInfo({ report }: { report: BadActorReportView }) {
  const dates = usePlantDates();
  const preference = useCalendarPreference();
  return (
    <span className="flex flex-col gap-1" data-testid="bad-actor-window">
      <span>
        Rolling <NumberText value={report.windowDays} /> days: {reviewWindowDates(report, { timeZone: dates.timezone, ...preference })} (both included). {valueBasisLabel(report.view)}.
      </span>
      <span data-testid="bad-actor-basis">{basisSentence(report.basis)}</span>
    </span>
  );
}

/** Which periods the approved figures leave out; shown with the table and with the empty message alike. */
function ExcludedNote({ report }: { report: BadActorReportView }) {
  const excluded = excludedPeriodsNote(report);
  if (!excluded) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="bad-actor-excluded">
      {excluded.charAt(0).toUpperCase()}
      {excluded.slice(1)}.
    </p>
  );
}

function ReportBody({ report }: { report: BadActorReportView }) {
  return (
    <div className="space-y-2" data-testid="bad-actor-report" data-rank-by={report.rankBy}>
      <BadActorTable report={report} />
    </div>
  );
}

/**
 * `/reliability/bad-actors` (CA8, SME 14 Oct 2026): the monthly review of the top assets or asset failure
 * modes over the RCA policy's rolling window, ranked on the server by approved loss, approved value or
 * stops, with each asset's cumulative bad-actor trigger state. Choices live in the URL. Title only, one
 * filter row and one report card (cleanup 24 Oct 2026); the window and value basis are behind the card ⓘ.
 */
export function BadActorPage() {
  const [params, setParams] = useSearchParams();
  const dates = usePlantDates();
  const { currency } = useDisplayCurrency();
  const { calendar } = useCalendarPreference();
  const { number } = useNumberFormat();
  const latestMonth = currentPlantMonth(dates.timezone, calendar);
  const filters = filtersFromParams(params, latestMonth);
  const query = useBadActorReport(badActorQuery(filters, currency));
  const report = query.data?.data;
  const change = (patch: Partial<BadActorFilters>) => setParams(paramsFromFilters({ ...filters, ...patch }), { replace: true });
  const count = report ? <span className="text-sm text-muted-foreground" data-testid="bad-actor-count">({number(report.items.length)})</span> : undefined;
  return (
    <Page width="wide">
      <div className="space-y-5">
        <PageHeader title="Bad actors" />
        <Controls filters={filters} latestMonth={latestMonth} onChange={change} />
        <ReportLookContext.Provider value={RELIABILITY_LOOK}>
          <ReportCard title={TITLE} info={report ? <ReportInfo report={report} /> : undefined} badge={count}>
            {report && <ExcludedNote report={report} />}
            <DataState
              state={dataStateOf(query, { isEmpty: report !== undefined && report.items.length === 0 })}
              detail={report?.items.length === 0 ? EMPTY_TEXT : undefined}
              error={query.error}
              onRetry={() => void query.refetch()}
            >
              {report && <ReportBody report={report} />}
            </DataState>
          </ReportCard>
        </ReportLookContext.Provider>
      </div>
    </Page>
  );
}
