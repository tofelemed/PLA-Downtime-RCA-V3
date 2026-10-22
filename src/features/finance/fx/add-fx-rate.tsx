import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FxRateView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useSaveResult } from '@/features/ux-kit/save-result';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { fxDraftResult } from '../model/finance-save-results';
import { FxRateForm } from './fx-rate-form';

/** "Add exchange rate draft": the form in a dialog; a saved draft closes it and opens the result dialog. */
export function AddFxRate() {
  const { timezone } = usePlantDates();
  const { digits } = useNumberFormat();
  const [open, setOpen] = useState(false);
  const result = useSaveResult();
  const saved = (rate: FxRateView) => {
    setOpen(false);
    result.open(fxDraftResult(rate, digits));
  };
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={() => setOpen(true)} data-testid="fx-new">
          <ActionIcon.add aria-hidden="true" />
          Add exchange rate draft
        </Button>
        <DialogContent className="flex max-h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>New exchange rate draft</DialogTitle>
            <DialogDescription>A finance approver other than you approves the draft before valuation uses it.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {open && <FxRateForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={saved} />}
          </div>
        </DialogContent>
      </Dialog>
      {result.element}
    </>
  );
}
