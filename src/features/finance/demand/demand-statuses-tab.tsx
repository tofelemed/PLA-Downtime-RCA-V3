import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemandStatuses } from '@/api/v2/queries/demand-statuses';
import { useProducts } from '@/api/v2/queries/profiles';
import type { DemandStatusView } from '@/api/v2/types/valuation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DEMAND_STATUS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { DemandActions } from './demand-actions';
import { DemandStatusForm } from './demand-status-form';

function AddDemandStatus() {
  const { timezone } = usePlantDates();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} data-testid="demand-new">
        <ActionIcon.add aria-hidden="true" />
        Add demand status draft
      </Button>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>New demand status draft</DialogTitle>
          <DialogDescription>A finance approver other than you approves it before the economic view uses it.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {open && <DemandStatusForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={() => setOpen(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Demand statuses of the plant's products (SME V3): lost output counts as a lost sale only where an
 * approved status says the product was sold out; elsewhere the economic view shows the tonnes with no
 * lost-sales value, and without any status it stays unvalued. All of it is decided on the server.
 */
export function DemandStatusesTab() {
  const { canMaintainValuation } = useCapabilities();
  const dates = usePlantDates();
  const statuses = useDemandStatuses({});
  const products = useProducts();
  const productName = (id: string) => products.data?.pages.flatMap((p) => p.items).find((p) => p.id === id)?.name ?? '—';
  const columns: Array<DataTableColumn<DemandStatusView>> = [
    { id: 'product', header: 'Product', cell: (s) => <span data-testid="demand-row">{productName(s.productId)}</span> },
    { id: 'status', header: 'Demand', cell: (s) => labelOf(DEMAND_STATUS_LABELS, s.status) },
    { id: 'valid', header: 'Valid', nowrap: true, cell: (s) => dates.validity(s.effectiveFrom, s.effectiveTo) },
    { id: 'evidence', header: 'Evidence', cell: (s) => s.evidence },
    { id: 'state', header: 'State', cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', cell: (s) => <DemandActions status={s} /> },
  ];
  return (
    <div className="space-y-4" data-testid="demand-statuses-tab">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ReadOnlyHint />
        {canMaintainValuation && <AddDemandStatus />}
      </div>
      <DataTable
        caption="Demand statuses"
        columns={columns}
        rows={statuses.rows}
        getRowKey={(s) => s.id}
        pager={statuses.pager}
        status={statuses.status}
        empty={{ title: 'No demand statuses', text: 'Without an approved status, the economic view of lost output stays unvalued.' }}
      />
    </div>
  );
}
