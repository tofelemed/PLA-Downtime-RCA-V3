import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { ActionIcon } from '@/lib/icons';
import type { MasterUnitView } from '../api/master-data-types';
import { UNITS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordListCard } from '../components/record-list-card';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';

/** Status only when the list mixes active and retired units (otherwise it repeats the filter on every row). */
function useColumns(showStatus: boolean): DataTableColumn<MasterUnitView>[] {
  const prefetch = usePrefetchRecord(UNITS);
  return [
    { id: 'code', header: 'Code', cell: (unit) => unit.code, nowrap: true },
    {
      id: 'name',
      header: 'Name',
      cell: (unit) => (
        <RecordLink to={`/master-data/units/${unit.id}`} onPrefetch={() => prefetch(unit.id)}>
          {unit.name}
        </RecordLink>
      ),
    },
    { id: 'uom', header: 'Unit of measure', cell: (unit) => unit.unitOfMeasure ?? '—', nowrap: true },
    { id: 'description', header: 'Description', cell: (unit) => unit.description ?? '—' },
    ...(showStatus ? [{ id: 'status', header: 'Status', nowrap: true, cell: (unit: MasterUnitView) => <RecordStatusBadge retired={unit.retiredAt !== null} /> }] : []),
  ];
}

/** `/master-data/units`: the plant's production units, 20 per page, searchable, active by default. */
export function UnitsPage() {
  const navigate = useNavigate();
  const { filters, update } = useListFilters();
  const canWrite = useMasterDataWriter();
  const units = useRecordPage<MasterUnitView>(UNITS, listQueryOf(filters));
  const columns = useColumns(filters.status === 'all');
  const addUnit = canWrite ? (
    <Button asChild>
      <Link to="/master-data/units/new">
        <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
        Add unit
      </Link>
    </Button>
  ) : undefined;
  return (
    <MasterDataLayout title="Production units" actions={addUnit}>
      <RecordListCard title="Units" testId="units-card">
        <ListToolbar filters={filters} onChange={update} searchLabel="Search units" compact />
        <DataTable
          caption="Production units"
          columns={columns}
          rows={units.rows}
          getRowKey={(unit) => unit.id}
          onRowClick={(unit) => navigate(`/master-data/units/${unit.id}`)}
          rowsHaveLink
          pager={units.pager}
          status={units.status}
          empty={{ title: 'No units', text: filters.q ? 'No unit matches the search.' : 'This plant has no units with this status yet.' }}
        />
      </RecordListCard>
    </MasterDataLayout>
  );
}
