import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { withReturnTo } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import type { MasterAssetView } from '../api/master-data-types';
import { ASSETS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { RecordLink } from '../components/record-link';
import { RecordListCard } from '../components/record-list-card';

/** The active assets under one unit (20 per page), with "Add asset" pre-set to the unit. */
export function UnitAssetsSection({ unitId, canAdd }: { unitId: string; canAdd: boolean }) {
  const assets = useRecordPage<MasterAssetView>(ASSETS, { unitIds: unitId, status: 'active', sort: 'code' });
  const prefetch = usePrefetchRecord(ASSETS);
  // the asset pages return here (Back, Cancel), not to the asset list (SETUP_UX_FIXES Phase 3)
  const here = `/master-data/units/${unitId}`;
  const columns: DataTableColumn<MasterAssetView>[] = [
    { id: 'code', header: 'Code', cell: (asset) => asset.code, nowrap: true },
    {
      id: 'name',
      header: 'Name',
      cell: (asset) => (
        <RecordLink to={withReturnTo(`/master-data/assets/${asset.id}`, here)} onPrefetch={() => prefetch(asset.id)}>
          {asset.name}
        </RecordLink>
      ),
    },
    { id: 'type', header: 'Type', cell: (asset) => asset.assetType ?? '—' },
    { id: 'criticality', header: 'Criticality', cell: (asset) => asset.criticality ?? '—' },
  ];
  const add = canAdd ? (
    <Button size="sm" variant="outline" className="h-9" asChild>
      <Link to={withReturnTo(`/master-data/assets/new?unitId=${unitId}`, here)}>
        <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
        Add asset
      </Link>
    </Button>
  ) : undefined;
  return (
    <RecordListCard title="Assets of this unit" actions={add} testId="unit-assets-card">
      <DataTable
        caption="Assets of this unit"
        columns={columns}
        rows={assets.rows}
        getRowKey={(asset) => asset.id}
        pager={assets.pager}
        status={assets.status}
        empty={{ title: 'No assets', text: 'This unit has no active assets.' }}
      />
    </RecordListCard>
  );
}
