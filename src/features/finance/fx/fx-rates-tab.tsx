import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFxRates } from '@/api/v2/queries/valuation';
import type { VersionState } from '@/api/v2/types/profiles';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { LoadMore } from '@/features/plans-profiles-calendars/components/load-more';
import { NativeSelect } from '@/features/plans-profiles-calendars/components/native-select';
import { FxRateForm } from './fx-rate-form';
import { FxRateTable } from './fx-rate-table';

const PAIRS = [
  { value: 'USD-IRR', label: 'USD → IRR' },
  { value: 'IRR-USD', label: 'IRR → USD' },
];
const STATES = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'retired', label: 'Retired' },
];

/**
 * The approved, dated FX table (plan 2.6, D08 Q2): versions per currency pair, `1 from = rate to`,
 * half-open validity; drafts are approved (with an optional supersede) or retired by a manager approver
 * with a tenant-wide grant. A loss whose date no approved rate covers keeps a null amount in the other
 * currency (`fx_rate_missing`) — nothing is estimated here or on the server.
 */
export function FxRatesTab({ timezone }: { timezone: string }) {
  const [pair, setPair] = useState('');
  const [state, setState] = useState('');
  const [adding, setAdding] = useState(false);
  const [fromCurrency, toCurrency] = pair ? pair.split('-') : [undefined, undefined];
  const rates = useFxRates({ fromCurrency, toCurrency, state: (state || undefined) as VersionState | undefined });
  return (
    <div className="space-y-3" data-testid="fx-rates-tab">
      <div className="flex flex-wrap items-end gap-3">
        <FormField id="fxPairFilter" label="Pair">
          <NativeSelect id="fxPairFilter" value={pair} options={PAIRS} placeholder="All pairs" onChange={setPair} />
        </FormField>
        <FormField id="fxStateFilter" label="State">
          <NativeSelect id="fxStateFilter" value={state} options={STATES} placeholder="All states" onChange={setState} />
        </FormField>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} data-testid="fx-new">
            Add FX rate draft
          </Button>
        )}
      </div>
      {adding && <FxRateForm timezone={timezone} onDone={() => setAdding(false)} />}
      <DataState
        state={dataStateOf(rates, { isEmpty: rates.items.length === 0 })}
        error={rates.error}
        detail="No FX rates: IRR and USD amounts are only reported in the currency a rate was entered in."
      >
        <FxRateTable rates={rates.items} timezone={timezone} />
        <LoadMore hasNextPage={rates.hasNextPage} isFetchingNextPage={rates.isFetchingNextPage} fetchNextPage={rates.fetchNextPage} />
      </DataState>
    </div>
  );
}
