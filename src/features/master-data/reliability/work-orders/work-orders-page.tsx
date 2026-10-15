import { Link, useSearchParams } from 'react-router-dom';
import { useImportWorkOrderOperations } from '@/api/v2/queries/reliability-work-orders';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { MasterDataLayout } from '../../components/master-data-layout';
import { AssetSelect } from '../shared/asset-select';
import { RowsImportPanel } from '../shared/rows-import-panel';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { WORK_ORDER_CSV_EXAMPLE, WORK_ORDER_CSV_HEADER, workOrderImportSummary, workOrderRowOf } from './work-order-import-model';
import { WorkOrderTable } from './work-order-table';

/** Filters in the URL (`?assetId=`, `?eventId=` from a stop's page), so Back and links keep them. */
function useOperationFilters() {
  const [params, setParams] = useSearchParams();
  const assetId = params.get('assetId') ?? '';
  const eventId = params.get('eventId') ?? '';
  const set = (key: 'assetId' | 'eventId', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return { assetId, eventId, set };
}

/**
 * `/master-data/work-orders` (SME D10): CMMS work-order operations — the actual diagnosis, repair and test
 * times minus waiting that give "Mean active repair time"; work-order creation and closure never count.
 */
export function WorkOrdersPage() {
  const { canWriteWorkOrders } = useCapabilities();
  const format = useReliabilityFormat();
  const filters = useOperationFilters();
  const importer = useImportWorkOrderOperations();
  return (
    <MasterDataLayout title="Work-order operations" alsoAllowed={canWriteWorkOrders} description="Maintenance operations from the CMMS, linked to the stops they repaired.">
      <Section title="Operations">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72"><AssetSelect id="wo-asset" label="Asset" value={filters.assetId} onChange={(v) => filters.set('assetId', v)} allowAll /></div>
          {filters.eventId && (
            <p className="flex items-center gap-2 text-sm" role="status">
              Operations of <Link className="underline" to={`/events/${filters.eventId}?tab=repair`}>one stop</Link>
              <Button size="sm" variant="ghost" onClick={() => filters.set('eventId', '')}>Show every stop</Button>
            </p>
          )}
        </div>
        <WorkOrderTable filters={{ assetId: filters.assetId || undefined, eventId: filters.eventId || undefined }} format={format} />
      </Section>
      {canWriteWorkOrders && (
        <Section title="Import the CMMS export" description="Rows upsert on work order + operation; a row without a stop is linked to the stop of its asset running at the operation start.">
          <RowsImportPanel
            id="work-orders"
            header={WORK_ORDER_CSV_HEADER}
            example={WORK_ORDER_CSV_EXAMPLE}
            mapRow={workOrderRowOf}
            submit={importer.submit}
            summary={workOrderImportSummary}
            pending={importer.isPending}
          />
        </Section>
      )}
    </MasterDataLayout>
  );
}
