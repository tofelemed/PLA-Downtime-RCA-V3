import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DemandStatusView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DEMAND_STATUS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useSaveResult } from '@/features/ux-kit/save-result';
import { ActionIcon } from '@/lib/icons';
import { FormDialog } from '@/features/plans-profiles-calendars/components/form-dialog';
import { demandDraftResult } from '../model/finance-save-results';
import { DemandStatusForm } from './demand-status-form';
import { useProductName } from './use-product-name';

const DEMAND_INFO = 'A finance approver other than you approves it before the economic view uses it.';

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
      <Button size="sm" className="whitespace-nowrap" onClick={() => setOpen(true)} data-testid="demand-new">
        <ActionIcon.add aria-hidden="true" />
        Add demand status draft
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="New demand status draft" info={DEMAND_INFO}>
        {open && <DemandStatusForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={saved} />}
      </FormDialog>
      {result.element}
    </>
  );
}
