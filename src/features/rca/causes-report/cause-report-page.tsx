import { useSearchParams } from 'react-router-dom';
import { useRcaCauseReport } from '@/api/v2/queries/rca-cause-report';
import type { RcaCauseReportView } from '@/api/v2/types/rca-cause-report';
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
import { causeReportQuery, filtersFromParams, KIND_LABELS, paramsFromFilters, SORT_LABELS, type CauseReportFilters } from './cause-report-model';
import { CauseReportTable } from './cause-report-table';

const TITLE = 'Top recurring causes';
const EMPTY_TEXT = 'No investigation in this selection names a cause code of the library yet.';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface ControlsProps {
  filters: CauseReportFilters;
  withMoney: boolean;
  onChange: (patch: Partial<CauseReportFilters>) => void;
}

/** One bottom-aligned row, labels above, h-9 controls: Unit, then what is ranked (one display-currency toggle per screen — the header's, QA re-test N4). */
function Controls({ filters, withMoney, onChange }: ControlsProps) {
  // ranking by approved loss needs the amounts, which the server leaves out for roles without money
  const sorts = withMoney ? options(SORT_LABELS) : options({ cases: SORT_LABELS.cases });
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label="Recurring cause filters" data-testid="cause-report-controls">
      <UnitField id="cause-report-unit" value={filters.unitId} onChange={(unitId) => onChange({ unitId })} />
      <SelectField id="cause-report-kind" label="Cause kind" value={filters.kind} options={options(KIND_LABELS)} onChange={(v) => onChange({ kind: v as CauseReportFilters['kind'] })} />
      <SelectField id="cause-report-sort" label="Rank by" value={filters.sort} options={sorts} onChange={(v) => onChange({ sort: v as CauseReportFilters['sort'] })} />
    </div>
  );
}

/** What the ranking counts and the value basis of its approved loss, behind the card ⓘ. */
function ReportInfo({ report, withMoney }: { report: RcaCauseReportView; withMoney: boolean }) {
  return (
    <span className="flex flex-col gap-1" data-testid="cause-report-note">
      <span>Investigations of your units naming each code of the cause library; the top 20 by number of investigations.</span>
      {withMoney && report.view && <span>{valueBasisLabel(report.view)}.</span>}
      {withMoney && report.basis && <span data-testid="cause-report-basis">{basisSentence(report.basis)}</span>}
    </span>
  );
}

/**
 * `/reliability/causes` (item 1.1): catalogue causes ranked on the server by the investigations naming them,
 * with the approved loss of those investigations in the display currency and a drill to the cases. Choices
 * live in the URL; the order and every figure are the server's. Title only, one filter row and one report
 * card (cleanup 24 Oct 2026); what the ranking counts is behind the card ⓘ.
 */
export function CauseReportPage() {
  const [params, setParams] = useSearchParams();
  const { currency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  const { number } = useNumberFormat();
  const filters = filtersFromParams(params);
  const effective = canViewMoney ? filters : { ...filters, sort: 'cases' as const };
  const query = useRcaCauseReport(causeReportQuery(effective, currency));
  const report = query.data;
  const change = (patch: Partial<CauseReportFilters>) => setParams(paramsFromFilters({ ...filters, ...patch }), { replace: true });
  const count = report ? <span className="text-sm text-muted-foreground" data-testid="cause-report-count">({number(report.items.length)})</span> : undefined;
  return (
    <Page width="wide">
      <div className="space-y-5">
        <PageHeader title="Recurring causes" />
        <Controls filters={effective} withMoney={canViewMoney} onChange={change} />
        <ReportLookContext.Provider value={RELIABILITY_LOOK}>
          <ReportCard title={TITLE} info={report ? <ReportInfo report={report} withMoney={canViewMoney} /> : undefined} badge={count}>
            <DataState
              state={dataStateOf(query, { isEmpty: report !== undefined && report.items.length === 0 })}
              detail={report?.items.length === 0 ? EMPTY_TEXT : undefined}
              error={query.error}
              onRetry={() => void query.refetch()}
            >
              {report && (
                <div data-testid="cause-report">
                  <CauseReportTable items={report.items} withMoney={canViewMoney} />
                </div>
              )}
            </DataState>
          </ReportCard>
        </ReportLookContext.Provider>
      </div>
    </Page>
  );
}
