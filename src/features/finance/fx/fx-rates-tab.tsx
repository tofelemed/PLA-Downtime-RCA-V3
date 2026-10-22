import { Label } from '@/components/ui/label';
import { useFxRates } from '@/api/v2/queries/valuation';
import type { VersionState } from '@/api/v2/types/profiles';
import { useUrlParam } from '@/features/codes-admin/hooks/use-url-param';
import { NativeSelect } from '@/features/integration-console/components/native-select';
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

/**
 * The approved, dated exchange rate table (plan 2.6, D08 Q2): versions per currency pair, `1 from = rate
 * to`, half-open validity; filters in the URL; a row opens the version (approve / retire there). A loss
 * whose date no approved rate covers keeps no amount in the other currency — nothing is estimated.
 * "Add exchange rate draft" is in the page header (`FinanceHeaderActions`).
 */
export function FxRatesTab() {
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
