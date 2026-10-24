import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useUnitNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import type { MasterAssetView } from '../api/master-data-types';
import { ASSETS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordListCard } from '../components/record-list-card';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { UnitSelect } from '../components/unit-select';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';

/** Unit only across units, Status only across active and retired: otherwise each repeats a filter on every row. */
function useColumns(show: { unit: boolean; status: boolean }): DataTableColumn<MasterAssetView>[] {
  const prefetch = usePrefetchRecord(ASSETS);
  const units = useUnitNames();
  return [
    { id: 'code', header: 'Code', cell: (asset) => asset.code, nowrap: true },
    {
      id: 'name',
      header: 'Name',
      cell: (asset) => (
        <RecordLink to={`/master-data/assets/${asset.id}`} onPrefetch={() => prefetch(asset.id)}>
          {asset.name}
        </RecordLink>
      ),
    },
    ...(show.unit ? [{ id: 'unit', header: 'Unit', cell: (asset: MasterAssetView) => units.nameOf(asset.unitId) }] : []),
    { id: 'type', header: 'Type', cell: (asset) => asset.assetType ?? '—' },
    { id: 'criticality', header: 'Criticality', cell: (asset) => asset.criticality ?? '—' },
    ...(show.status ? [{ id: 'status', header: 'Status', nowrap: true, cell: (asset: MasterAssetView) => <RecordStatusBadge retired={asset.retiredAt !== null} /> }] : []),
  ];
}

/** `/master-data/assets`: the plant's assets, 20 per page; filter by unit, search, status. */
export function AssetsPage() {
  const navigate = useNavigate();
  const { filters, update } = useListFilters();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const canWrite = useMasterDataWriter();
  const assets = useRecordPage<MasterAssetView>(ASSETS, { ...listQueryOf(filters), ...(unitId ? { unitIds: unitId } : {}) });
  const columns = useColumns({ unit: !unitId, status: filters.status === 'all' });
  const setUnit = (next: string) =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      if (next) copy.set('unitId', next);
      else copy.delete('unitId');
      return copy;
    }, { replace: true });
  const addAsset = canWrite ? (
    <Button asChild>
      <Link to={unitId ? `/master-data/assets/new?unitId=${unitId}` : '/master-data/assets/new'}>
        <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
        Add asset
      </Link>
    </Button>
  ) : undefined;
  return (
    <MasterDataLayout title="Assets" actions={addAsset}>
      <RecordListCard title="Assets" testId="assets-card">
        <ListToolbar
          filters={filters}
          onChange={update}
          searchLabel="Search assets"
          compact
          leading={<UnitSelect id="asset-unit-filter" label="Unit" value={unitId} onChange={setUnit} allowAll compact triggerClassName="w-full sm:w-64" />}
        />
        <DataTable
          caption="Assets"
          columns={columns}
          rows={assets.rows}
          getRowKey={(asset) => asset.id}
          onRowClick={(asset) => navigate(`/master-data/assets/${asset.id}`)}
          rowsHaveLink
          pager={assets.pager}
          status={assets.status}
          empty={{ title: 'No assets', text: filters.q || unitId ? 'No asset matches the filters.' : 'This plant has no assets with this status yet.' }}
        />
      </RecordListCard>
    </MasterDataLayout>
  );
}
