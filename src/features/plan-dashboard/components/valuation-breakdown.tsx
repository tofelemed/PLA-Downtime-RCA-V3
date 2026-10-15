import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLossValueBreakdown, type LossValueQuery } from '@/api/v2/queries/period-overview';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EconomicBreakdownTable } from '@/features/valuation-breakdown/economic-breakdown-table';

/**
 * VA-04 drill of the period valuation tiles: the economic view of the period by component, fetched from
 * the server only when opened (same window, ledger and approval rule as the tiles).
 */
export function ValuationBreakdown({ query }: { query: LossValueQuery }) {
  const [open, setOpen] = useState(false);
  const report = useLossValueBreakdown(open ? query : null);
  return (
    <div className="space-y-2" data-testid="valuation-breakdown">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide breakdown' : 'Breakdown'}
      </Button>
      {open && (
        <DataState state={dataStateOf(report)} error={report.error}>
          <EconomicBreakdownTable components={report.data?.data.components ?? []} caption="Economic impact of the period by component" />
        </DataState>
      )}
    </div>
  );
}
