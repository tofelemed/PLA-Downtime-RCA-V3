import { useRetireStandby, useStandbyEquipmentPage } from '@/api/v2/queries/reliability-standby';
import type { StandbyEquipmentView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { useAssetLookup } from '../shared/use-asset-lookup';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { EVALUATION_LABELS } from './standby-metrics-model';
import { standbyEmptyText } from './standby-empty-text';

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

interface RetireDialogProps {
  row: StandbyEquipmentView | null;
  assetLabel: (id: string) => string;
  onClose: () => void;
}

/** "End standby duty?": the registration ends now; its demand and failure log is kept. */
function RetireStandbyDialog({ row, assetLabel, onClose }: RetireDialogProps) {
  const retire = useRetireStandby();
  const { toast } = useToast();
  const run = async (target: StandbyEquipmentView) => {
    try {
      await retire.submit(target.id);
      toast({ title: `${assetLabel(target.assetId)}: standby duty ended` });
    } catch (failure) {
      toast({ ...friendlyToastContent(failure), variant: 'destructive' });
      throw failure;
    }
  };
  return (
    <ConfirmDialog
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      title={row ? `Retire standby duty of ${assetLabel(row.assetId)}?` : 'Retire standby duty?'}
      description="The duty ends now. Its demands and failures stay in the log and in the standby metrics."
      confirmLabel="Retire standby"
      destructive
      onConfirm={() => (row ? run(row) : undefined)}
    />
  );
}

/** Standby registrations of the caller's scope; retiring (after confirmation) ends the duty now and keeps its log. */
export function StandbyRegistrationsTable({ format, canWrite }: { format: ReliabilityFormat; canWrite: boolean }) {
  const page = useStandbyEquipmentPage();
  const { labelOf } = useAssetLookup();
  const [retiring, setRetiring] = useState<StandbyEquipmentView | null>(null);
  return (
    <>
      <DataTable
        caption="Standby registrations"
        columns={columnsOf({ format, assetLabel: labelOf, onRetire: canWrite ? setRetiring : null })}
        rows={page.rows}
        pager={page.pager}
        getRowKey={(r) => r.id}
        status={page.status}
        empty={{ title: 'No standby equipment', text: standbyEmptyText(canWrite) }}
      />
      <RetireStandbyDialog row={retiring} assetLabel={labelOf} onClose={() => setRetiring(null)} />
    </>
  );
}
