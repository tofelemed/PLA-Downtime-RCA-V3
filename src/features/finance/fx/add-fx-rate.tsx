import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FxRateView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useSaveResult } from '@/features/ux-kit/save-result';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { FormDialog } from '@/features/plans-profiles-calendars/components/form-dialog';
import { fxDraftResult } from '../model/finance-save-results';
import { FxRateForm } from './fx-rate-form';

const FX_INFO =
  'A finance approver other than you approves the draft before valuation uses it. The rate table is the conversion basis (name the market or fixing under Source); the rate applies up to, not including, Valid until. A provisional rate is only for dates without an approved final rate: values it converts are marked provisional and revalued when the final rate is approved; it needs an end date.';

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
      <Button size="sm" className="whitespace-nowrap" onClick={() => setOpen(true)} data-testid="fx-new">
        <ActionIcon.add aria-hidden="true" />
        Add exchange rate draft
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="New exchange rate draft" info={FX_INFO}>
        {open && <FxRateForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={saved} />}
      </FormDialog>
      {result.element}
    </>
  );
}
