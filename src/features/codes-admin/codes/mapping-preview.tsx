import { useCodeMappingPreview } from '@/api/v2/queries/codes-admin';
import type { AxisDefaultView, CodeMappingPreviewView } from '@/api/v2/types/codes-admin';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf } from '@/features/ux-kit/labels';
import { MAPPING_SOURCE_LABELS, OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';

type Axis = 'scheduleClass' | 'oeeComponent';

interface AxisRow {
  axis: Axis;
  label: string;
  values: Readonly<Record<string, string>>;
}

const AXES: readonly AxisRow[] = [
  { axis: 'scheduleClass', label: 'Schedule class', values: SCHEDULE_CLASS_LABELS },
  { axis: 'oeeComponent', label: 'OEE component', values: OEE_COMPONENT_LABELS },
];

function proposedText(row: AxisRow, proposed: AxisDefaultView | undefined): string {
  if (!proposed) return 'None';
  const version = proposed.ruleVersion ? `, version ${proposed.ruleVersion}` : '';
  return `${labelOf(row.values, proposed.value)} (${MAPPING_SOURCE_LABELS[proposed.source]}${version})`;
}

function currentText(row: AxisRow, counts: Record<string, number>): string {
  const parts = Object.entries(counts).map(([value, count]) => `${labelOf(row.values, value === 'null' ? '' : value, 'Not set')}: ${count}`);
  return parts.join(', ') || '—';
}

function columnsOf(data: CodeMappingPreviewView): Array<DataTableColumn<AxisRow>> {
  return [
    { id: 'axis', header: 'Classification', cell: (row) => row.label },
    { id: 'proposed', header: 'Default in force now', cell: (row) => proposedText(row, data.proposed[row.axis]) },
    { id: 'current', header: "Today's classification", cell: (row) => currentText(row, data.current[row.axis]) },
    {
      id: 'differ',
      header: 'Would differ',
      align: 'right',
      cell: (row) => (
        <span data-testid="preview-axis" data-axis={row.axis} data-proposed={data.proposed[row.axis]?.value ?? ''} data-differ={data.wouldDiffer[row.axis]}>
          {data.proposed[row.axis] ? data.wouldDiffer[row.axis] : '—'}
        </span>
      ),
    },
  ];
}

/**
 * "Events coded with this reason in the last 30 days would be classified as …" — every count comes from
 * the server (`GET /reason-codes/{id}/mapping-preview`), none is computed here.
 */
export function MappingPreview({ codeId }: { codeId: string }) {
  const preview = useCodeMappingPreview(codeId, 30);
  const data = preview.data;
  return (
    <DataState state={dataStateOf(preview)} error={preview.error} onRetry={() => void preview.refetch()}>
      {data && (
        <div className="space-y-2 text-sm" data-testid="mapping-preview" data-events={data.events}>
          <p>
            <strong>{data.events}</strong> event(s) in your scope were coded with this reason in the last 30 days.
          </p>
          <DataTable caption="Mapping preview" columns={columnsOf(data)} rows={AXES} getRowKey={(row) => row.axis} pager="none" density="compact" />
          <p className="text-muted-foreground">Stored events keep their classification; defaults apply to new codings.</p>
        </div>
      )}
    </DataState>
  );
}
