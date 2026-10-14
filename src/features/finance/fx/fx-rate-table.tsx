import { useNavigate } from 'react-router-dom';
import type { FxRateView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataTable, type DataTableColumn, type DataTableEmpty, type DataTableStatus, type PagerModel } from '@/features/ux-kit/data-table';
import { FX_RATE_TYPE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { VersionStateBadge } from '../components/version-state-badge';

export interface FxRateTableProps {
  rates: readonly FxRateView[];
  pager?: PagerModel;
  status?: DataTableStatus;
  empty?: DataTableEmpty;
}

/** Exchange rate versions in server order, 20 per page; the rate is the server's decimal string, unrounded. */
export function FxRateTable({ rates, pager, status, empty }: FxRateTableProps) {
  const navigate = useNavigate();
  const dates = usePlantDates();
  const columns: Array<DataTableColumn<FxRateView>> = [
    {
      id: 'pair',
      header: 'Currencies',
      nowrap: true,
      cell: (rate) => (
        <span data-testid="fx-row" data-source={rate.source ?? ''} data-state={rate.state}>
          {rate.fromCurrency} → {rate.toCurrency}
        </span>
      ),
    },
    { id: 'type', header: 'Rate table', cell: (rate) => <span data-testid="fx-type">{labelOf(FX_RATE_TYPE_LABELS, rate.rateType)}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (rate) => `Version ${rate.version}` },
    { id: 'rate', header: 'Rate', align: 'right', nowrap: true, cell: (rate) => <span className="font-mono text-xs" data-testid="fx-rate">1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}</span> },
    { id: 'valid', header: 'Valid', nowrap: true, cell: (rate) => dates.validity(rate.effectiveFrom, rate.effectiveTo) },
    { id: 'source', header: 'Source', cell: (rate) => rate.source ?? '—' },
    { id: 'state', header: 'State', cell: (rate) => <VersionStateBadge state={rate.state} /> },
  ];
  return (
    <DataTable
      caption="Exchange rates"
      columns={columns}
      rows={rates}
      getRowKey={(rate) => rate.id}
      pager={pager}
      status={status}
      empty={empty}
      onRowClick={(rate) => navigate(`/finance/fx/${rate.id}`)}
      rowLabel={(rate) => `${rate.fromCurrency} to ${rate.toCurrency} version ${rate.version}`}
    />
  );
}
