import { useSearchParams } from 'react-router-dom';
import { useImportWorkOrderOperations } from '@/api/v2/queries/reliability-work-orders';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { MasterDataLayout } from '../../components/master-data-layout';
import { RowsImportPanel } from '../shared/rows-import-panel';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { WORK_ORDER_CSV_EXAMPLE, WORK_ORDER_CSV_COLUMNS, workOrderImportSummary, workOrderRowOf } from './work-order-import-model';
import { WorkOrderCard } from './work-order-card';
import { WorkOrderFiltersBar } from './work-order-filters';
import { WorkOrderTable } from './work-order-table';

/** The shared report table look; operations carry no provisional figures, and an empty table says its own thing. */
const WORK_ORDERS_LOOK = { provisional: false, ownEmpty: true } as const;
const OPERATIONS_INFO = 'Maintenance operations from the CMMS, linked to the stops they repaired. Diagnosis, repair and functional test count as active repair; other operations do not.';
const IMPORT_INFO = 'Rows upsert on work order + operation; a row without a stop is linked to the stop of its asset running at the operation start.';

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
    <MasterDataLayout title="Work-order operations" alsoAllowed={canWriteWorkOrders}>
      <ReportLookContext.Provider value={WORK_ORDERS_LOOK}>
        <WorkOrderCard id="wo-operations-title" title="Operations" info={{ label: 'work-order operations', text: OPERATIONS_INFO }}>
          <WorkOrderFiltersBar assetId={filters.assetId} eventId={filters.eventId} onChange={filters.set} />
          <WorkOrderTable filters={{ assetId: filters.assetId || undefined, eventId: filters.eventId || undefined }} format={format} density="compact" />
        </WorkOrderCard>
      </ReportLookContext.Provider>
      {canWriteWorkOrders && (
        <WorkOrderCard id="wo-import-title" title="Import the CMMS export" info={{ label: 'the CMMS import', text: IMPORT_INFO }}>
          <RowsImportPanel
            id="work-orders"
            columns={WORK_ORDER_CSV_COLUMNS}
            example={WORK_ORDER_CSV_EXAMPLE}
            mapRow={workOrderRowOf}
            submit={importer.submit}
            summary={workOrderImportSummary}
            pending={importer.isPending}
          />
        </WorkOrderCard>
      )}
    </MasterDataLayout>
  );
}
