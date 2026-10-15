import { useStandbyMetrics, useStandbyRecordsPage, type StandbyWindow } from '@/api/v2/queries/reliability-standby';
import type { StandbyMetricsView, StandbyRecordView } from '@/api/v2/types/reliability';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { useAssetLookup } from '../shared/use-asset-lookup';
import { usePlantWindow } from '../shared/use-plant-window';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { EVALUATION_LABELS, fractionText, mtbfText, OUTCOME_LABELS, RECORD_KIND_LABELS } from './standby-metrics-model';

type Labels = { format: ReliabilityFormat; assetLabel: (id: string) => string };

const metricColumns = ({ format, assetLabel }: Labels): DataTableColumn<StandbyMetricsView>[] => [
  { id: 'asset', header: 'Asset', cell: (m) => assetLabel(m.assetId) },
  { id: 'evaluation', header: 'Evaluated', cell: (m) => EVALUATION_LABELS[m.evaluation] },
  { id: 'demand', header: 'Failure on demand', cell: (m) => fractionText(m.failureOnDemand, format) },
  { id: 'tests', header: 'Test failures', cell: (m) => fractionText(m.testFailureFraction, format) },
  { id: 'mtbf', header: 'Operating MTBF', cell: (m) => mtbfText(m, format) },
  { id: 'standby', header: 'Time on standby', cell: (m) => format.duration(m.standbySeconds), nowrap: true },
];

const recordColumns = ({ format, assetLabel }: Labels): DataTableColumn<StandbyRecordView>[] => [
  { id: 'asset', header: 'Asset', cell: (r) => assetLabel(r.assetId) },
  { id: 'kind', header: 'Entry', cell: (r) => RECORD_KIND_LABELS[r.kind] },
  { id: 'start', header: 'Start', cell: (r) => format.dateTime(r.startedAt), nowrap: true },
  { id: 'end', header: 'End', cell: (r) => format.dateTime(r.endedAt), nowrap: true },
  { id: 'outcome', header: 'Outcome', cell: (r) => OUTCOME_LABELS[r.outcome] },
  { id: 'ref', header: 'Log reference', cell: (r) => r.externalRef ?? '—' },
];

function StandbyTables({ window, labels }: { window: StandbyWindow; labels: Labels }) {
  const metrics = useStandbyMetrics(window);
  const records = useStandbyRecordsPage(window);
  return (
    <>
      <DataTable
        caption="Standby measures per asset"
        columns={metricColumns(labels)}
        rows={metrics.data ?? []}
        getRowKey={(m) => m.assetId}
        status={{ isLoading: metrics.isLoading, isError: metrics.isError, error: metrics.error, onRetry: () => void metrics.refetch() }}
        empty={{ title: 'No standby equipment in this window' }}
      />
      <h3 className="pt-2 text-sm font-medium">Log entries</h3>
      <DataTable caption="Standby log entries" columns={recordColumns(labels)} rows={records.rows} pager={records.pager} getRowKey={(r) => r.id} status={records.status} empty={{ title: 'No log entries in this window' }} />
    </>
  );
}

/**
 * SME D9 measures over a window: failed starts per start demand and test failures counted separately; the
 * operating MTBF uses the asset's own running time — with no failure the exposure is shown, never infinity.
 */
export function StandbyMetricsSection({ format }: { format: ReliabilityFormat }) {
  const { range, setRange, window } = usePlantWindow(30, format.timezone);
  const { labelOf } = useAssetLookup();
  return (
    <div className="space-y-3">
      <DateRangeInput label="Window" value={range} timeZone={format.timezone} onChange={setRange} />
      {window && <StandbyTables window={window} labels={{ format, assetLabel: labelOf }} />}
    </div>
  );
}
