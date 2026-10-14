import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFxRates } from '@/api/v2/queries/valuation';
import type { VersionState } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useUrlParam } from '@/features/codes-admin/hooks/use-url-param';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { FxRateForm } from './fx-rate-form';
import { FxRateTable } from './fx-rate-table';

const PAIRS = ['', 'USD-IRR', 'IRR-USD'] as const;
const STATES = ['', 'draft', 'approved', 'retired'] as const;
const PAIR_OPTIONS = [
  { value: 'USD-IRR', label: 'USD → IRR' },
  { value: 'IRR-USD', label: 'IRR → USD' },
];
const STATE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'retired', label: 'Retired' },
];

function AddFxRate() {
  const navigate = useNavigate();
  const { timezone } = usePlantDates();
  const [open, setOpen] = useState(false);
  return (
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
          {open && <FxRateForm timezone={timezone} onCancel={() => setOpen(false)} onSaved={(rate) => navigate(`/finance/fx/${rate.id}`)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The approved, dated exchange rate table (plan 2.6, D08 Q2): versions per currency pair, `1 from = rate
 * to`, half-open validity; filters in the URL; a row opens the version (approve / retire there). A loss
 * whose date no approved rate covers keeps no amount in the other currency — nothing is estimated.
 */
export function FxRatesTab() {
  const { canMaintainValuation } = useCapabilities();
  const [pair, setPair] = useUrlParam('pair', PAIRS, '');
  const [state, setState] = useUrlParam('state', STATES, '');
  const [fromCurrency, toCurrency] = pair ? pair.split('-') : [undefined, undefined];
  const rates = useFxRates({ fromCurrency, toCurrency, state: (state || undefined) as VersionState | undefined });
  return (
    <div className="space-y-4" data-testid="fx-rates-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1">
          <Label htmlFor="fxPairFilter">Currencies</Label>
          <NativeSelect id="fxPairFilter" value={pair} options={PAIR_OPTIONS} placeholder="All" onChange={(value) => setPair(value as (typeof PAIRS)[number])} />
        </div>
        <div className="w-40 space-y-1">
          <Label htmlFor="fxStateFilter">State</Label>
          <NativeSelect id="fxStateFilter" value={state} options={STATE_OPTIONS} placeholder="All states" onChange={(value) => setState(value as (typeof STATES)[number])} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ReadOnlyHint />
          {canMaintainValuation && <AddFxRate />}
        </div>
      </div>
      <FxRateTable
        rates={rates.rows}
        pager={rates.pager}
        status={rates.status}
        empty={{ title: 'No exchange rates', text: 'Without an approved rate, amounts are reported only in the currency they were entered in.' }}
      />
    </div>
  );
}
