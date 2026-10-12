import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useUnitNames } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import type { MasterAssetView } from '../api/master-data-types';
import { ASSETS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { UnitSelect } from '../components/unit-select';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';

function useColumns(): DataTableColumn<MasterAssetView>[] {
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
    { id: 'unit', header: 'Unit', cell: (asset) => units.nameOf(asset.unitId) },
    { id: 'type', header: 'Type', cell: (asset) => asset.assetType ?? '—' },
    { id: 'criticality', header: 'Criticality', cell: (asset) => asset.criticality ?? '—' },
    { id: 'status', header: 'Status', cell: (asset) => <RecordStatusBadge retired={asset.retiredAt !== null} /> },
  ];
}

/** `/master-data/assets`: the plant's assets, 20 per page; filter by unit, search, status. */
export function AssetsPage() {
  const { filters, update } = useListFilters();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const canWrite = useMasterDataWriter();
  const assets = useRecordPage<MasterAssetView>(ASSETS, { ...listQueryOf(filters), ...(unitId ? { unitIds: unitId } : {}) });
  const columns = useColumns();
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
    <MasterDataLayout title="Assets" description="Equipment and instruments of the selected plant, each under a unit." actions={addAsset}>
      <Section title="Assets">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <UnitSelect id="asset-unit-filter" label="Unit" value={unitId} onChange={setUnit} allowAll />
          </div>
          <ListToolbar filters={filters} onChange={update} searchLabel="Search assets" />
        </div>
        <DataTable
          caption="Assets"
          columns={columns}
          rows={assets.rows}
          getRowKey={(asset) => asset.id}
          pager={assets.pager}
          status={assets.status}
          empty={{ title: 'No assets', text: filters.q || unitId ? 'No asset matches the filters.' : 'This plant has no assets with this status yet.' }}
        />
      </Section>
    </MasterDataLayout>
  );
}
