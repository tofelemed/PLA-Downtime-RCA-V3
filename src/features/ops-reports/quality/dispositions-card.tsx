import { useQualityDispositions } from '@/api/v2/queries/ops-reports';
import type { DispositionGroupView } from '@/api/v2/types/ops-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DISPOSITION_CLASS_LABELS, DISPOSITION_STATE_LABELS } from '@/features/ux-kit/disposition-labels';
import { NumberText } from '@/features/ux-kit/number-text';
import { PlantTime } from '@/features/ux-kit/plant-time';

const COLUMNS: Array<DataTableColumn<DispositionGroupView>> = [
  { id: 'class', header: 'Class', cell: (g) => <span data-testid="disposition-group">{DISPOSITION_CLASS_LABELS[g.dispositionClass] ?? g.dispositionClass}</span> },
  { id: 'state', header: 'Decision', cell: (g) => DISPOSITION_STATE_LABELS[g.state] ?? g.state },
  { id: 'product', header: 'Product', cell: (g) => g.productCode ?? '—' },
  { id: 'lots', header: 'Lots', align: 'right', cell: (g) => <NumberText value={g.lots} /> },
  { id: 'quantity', header: 'Quantity', align: 'right', nowrap: true, cell: (g) => <><NumberText value={g.quantity} fractionDigits={1} /> {g.uom}</> },
];

/** Lot dispositions of the window (R4): what quality decided per class and product, and what still waits. */
export function DispositionsCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useQualityDispositions(scopeBase(scope), env.timezone);
  const data = query.data;
  const state = dataStateOf(query, { isEmpty: data !== undefined && data.groups.length === 0 });
  return (
    <Card data-testid="quality-dispositions">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lot dispositions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data && data.pending > 0 && (
          <p className="text-sm" data-testid="quality-pending">
            <NumberText value={data.pending} /> {data.pending === 1 ? 'lot waits' : 'lots wait'} for a quality decision
            {data.oldestPendingAt && (
              <>
                {' '}(oldest since <PlantTime iso={data.oldestPendingAt} tz={env.timezone} withDate />)
              </>
            )}
            .
          </p>
        )}
        <DataState state={state} error={query.error} detail={state === 'empty' ? 'No lot dispositions for lots produced on these dates.' : undefined} onRetry={() => void query.refetch()}>
          <DataTable caption="Lot dispositions" columns={COLUMNS} rows={data?.groups ?? []} getRowKey={(g) => `${g.dispositionClass}|${g.state}|${g.productId ?? '-'}|${g.uom}`} density="compact" />
        </DataState>
      </CardContent>
    </Card>
  );
}
