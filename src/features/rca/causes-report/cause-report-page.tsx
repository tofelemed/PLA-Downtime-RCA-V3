import { useSearchParams } from 'react-router-dom';
import { useRcaCauseReport } from '@/api/v2/queries/rca-cause-report';
import type { RcaCauseReportView } from '@/api/v2/types/rca-cause-report';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { causeReportQuery, filtersFromParams, KIND_LABELS, paramsFromFilters, SORT_LABELS, type CauseReportFilters } from './cause-report-model';
import { CauseReportTable } from './cause-report-table';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface ControlsProps {
  filters: CauseReportFilters;
  withMoney: boolean;
  onChange: (patch: Partial<CauseReportFilters>) => void;
}

function Controls({ filters, withMoney, onChange }: ControlsProps) {
  // ranking by approved loss needs the amounts, which the server leaves out for roles without money
  const sorts = withMoney ? options(SORT_LABELS) : options({ cases: SORT_LABELS.cases });
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="cause-report-controls">
      <div className="space-y-1">
        <Label htmlFor="cause-report-kind">Cause kind</Label>
        <NativeSelect id="cause-report-kind" value={filters.kind} options={options(KIND_LABELS)} onChange={(v) => onChange({ kind: v as CauseReportFilters['kind'] })} />
      </div>
      <div className="w-56">
        <UnitSelect id="cause-report-unit" label="Unit" value={filters.unitId} allowAll onChange={(unitId) => onChange({ unitId })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cause-report-sort">Rank by</Label>
        <NativeSelect id="cause-report-sort" value={filters.sort} options={sorts} onChange={(v) => onChange({ sort: v as CauseReportFilters['sort'] })} />
      </div>
      {/* one display-currency toggle per screen — the header's (QA re-test N4) */}
    </div>
  );
}

function ReportNote({ report, withMoney }: { report: RcaCauseReportView; withMoney: boolean }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground" data-testid="cause-report-note">
      <p>Investigations of your units naming each code of the cause library; the top 20 by number of investigations.</p>
      {withMoney && report.view && <p>{valueBasisLabel(report.view)}.</p>}
      {withMoney && report.basis && <p data-testid="cause-report-basis">{basisSentence(report.basis)}</p>}
    </div>
  );
}

/**
 * `/reliability/causes` (item 1.1): catalogue causes ranked on the server by the investigations naming them,
 * with the approved loss of those investigations in the display currency and a drill to the cases. Choices
 * live in the URL; the order and every figure are the server's.
 */
export function CauseReportPage() {
  const [params, setParams] = useSearchParams();
  const { currency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  const filters = filtersFromParams(params);
  const effective = canViewMoney ? filters : { ...filters, sort: 'cases' as const };
  const query = useRcaCauseReport(causeReportQuery(effective, currency));
  const report = query.data;
  const change = (patch: Partial<CauseReportFilters>) => setParams(paramsFromFilters({ ...filters, ...patch }), { replace: true });
  return (
    <Page width="wide">
      <PageHeader title="Recurring causes" description="The cause codes your investigations name most often, and the approved loss behind them." />
      <Section title="Top recurring causes" actions={<Controls filters={effective} withMoney={canViewMoney} onChange={change} />}>
        <DataState
          state={dataStateOf(query, { isEmpty: report !== undefined && report.items.length === 0 })}
          detail={report?.items.length === 0 ? 'No investigation in this selection names a cause code of the library yet.' : undefined}
          error={query.error}
          onRetry={() => void query.refetch()}
        >
          {report && (
            <div className="space-y-2" data-testid="cause-report">
              <ReportNote report={report} withMoney={canViewMoney} />
              <CauseReportTable items={report.items} withMoney={canViewMoney} />
            </div>
          )}
        </DataState>
      </Section>
    </Page>
  );
}
