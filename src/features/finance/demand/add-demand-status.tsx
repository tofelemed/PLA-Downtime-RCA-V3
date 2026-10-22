import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DemandStatusView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DEMAND_STATUS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useSaveResult } from '@/features/ux-kit/save-result';
import { ActionIcon } from '@/lib/icons';
import { demandDraftResult } from '../model/finance-save-results';
import { DemandStatusForm } from './demand-status-form';
import { useProductName } from './use-product-name';

/**
 * "Add demand status draft": the form in a dialog; a saved draft closes it and opens the result dialog, like
 * an exchange rate draft (a create, and the author learns it still needs another approver).
 */
export function AddDemandStatus() {
  const productName = useProductName();
  const { timezone } = usePlantDates();
  const [open, setOpen] = useState(false);
  const result = useSaveResult();
  const saved = (status: DemandStatusView) => {
    setOpen(false);
    result.open(demandDraftResult(status, `${productName(status.productId)} — ${labelOf(DEMAND_STATUS_LABELS, status.status)}`));
  };
  return (
    <>
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
            {open && <DemandStatusForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={saved} />}
          </div>
        </DialogContent>
      </Dialog>
      {result.element}
    </>
  );
}
