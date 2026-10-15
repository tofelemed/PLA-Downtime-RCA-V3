import { useRetireStandby, useStandbyEquipmentPage } from '@/api/v2/queries/reliability-standby';
import type { StandbyEquipmentView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { useAssetLookup } from '../shared/use-asset-lookup';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { EVALUATION_LABELS } from './standby-metrics-model';

interface ColumnInput {
  format: ReliabilityFormat;
  assetLabel: (id: string) => string;
  /** null = the user may not retire (no write capability) */
  onRetire: ((row: StandbyEquipmentView) => void) | null;
}

function columnsOf({ format, assetLabel, onRetire }: ColumnInput): DataTableColumn<StandbyEquipmentView>[] {
  const columns: DataTableColumn<StandbyEquipmentView>[] = [
    { id: 'asset', header: 'Asset', cell: (r) => assetLabel(r.assetId) },
    { id: 'evaluation', header: 'Evaluated', cell: (r) => EVALUATION_LABELS[r.evaluation] },
    { id: 'from', header: 'Standby from', cell: (r) => format.dateTime(r.effectiveFrom), nowrap: true },
    { id: 'to', header: 'Until', cell: (r) => (r.effectiveTo ? format.dateTime(r.effectiveTo) : 'In duty'), nowrap: true },
  ];
  if (!onRetire) return columns;
  const retire = (r: StandbyEquipmentView) => (r.effectiveTo ? null : <Button size="sm" variant="ghost" onClick={() => onRetire(r)}>Retire</Button>);
  return [...columns, { id: 'actions', header: '', headerLabel: 'Actions', align: 'right', cell: retire }];
}

/** Standby registrations of the caller's scope; retiring ends the duty now and keeps its log. */
export function StandbyRegistrationsTable({ format, canWrite }: { format: ReliabilityFormat; canWrite: boolean }) {
  const page = useStandbyEquipmentPage();
  const { labelOf } = useAssetLookup();
  const retire = useRetireStandby();
  const { toast } = useToast();
  const onRetire = (row: StandbyEquipmentView) =>
    void retire.submit(row.id).then(
      () => toast({ title: `${labelOf(row.assetId)}: standby duty ended` }),
      (failure: unknown) => toast({ ...friendlyToastContent(failure), variant: 'destructive' }),
    );
  return (
    <DataTable
      caption="Standby registrations"
      columns={columnsOf({ format, assetLabel: labelOf, onRetire: canWrite ? onRetire : null })}
      rows={page.rows}
      pager={page.pager}
      getRowKey={(r) => r.id}
      status={page.status}
      empty={{ title: 'No standby equipment', text: 'Register spare pumps or standby compressors to measure failures on demand.' }}
    />
  );
}
