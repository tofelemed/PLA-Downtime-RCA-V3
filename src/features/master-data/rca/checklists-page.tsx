import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { RcaCard } from '@/features/rca/components/rca-card';
import { ActionIcon } from '@/lib/icons';
import type { VerificationChecklistView } from '../api/master-data-types';
import { VERIFICATION_CHECKLISTS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { BulkRetireButton } from '../components/bulk-retire-button';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRefreshRcaSettings } from '../hooks/use-refresh-rca-settings';
import { useRowSelection } from '../hooks/use-row-selection';
import { ColorSwatch } from './color-swatch';

function useColumns(selectColumn: DataTableColumn<VerificationChecklistView> | null): DataTableColumn<VerificationChecklistView>[] {
  const prefetch = usePrefetchRecord(VERIFICATION_CHECKLISTS);
  return [
    ...(selectColumn ? [selectColumn] : []),
    { id: 'code', header: 'Code', cell: (checklist) => checklist.code, nowrap: true },
    {
      id: 'name',
      header: 'Name',
      cell: (checklist) => (
        <span className="inline-flex items-center gap-2">
          <ColorSwatch color={checklist.color} />
          <RecordLink to={`/master-data/rca/checklists/${checklist.id}`} onPrefetch={() => prefetch(checklist.id)}>
            {checklist.name}
          </RecordLink>
        </span>
      ),
    },
    { id: 'items', header: 'Items', align: 'right', cell: (checklist) => checklist.items.length },
    { id: 'status', header: 'Status', cell: (checklist) => <RecordStatusBadge retired={!checklist.isActive} /> },
  ];
}

/** `/master-data/rca/checklists`: verification checklists of the plant, 20 per page. */
export function ChecklistsPage() {
  const navigate = useNavigate();
  const { filters, update } = useListFilters();
  const canWrite = useMasterDataWriter();
  const refresh = useRefreshRcaSettings();
  const checklists = useRecordPage<VerificationChecklistView>(VERIFICATION_CHECKLISTS, listQueryOf(filters));
  const selection = useRowSelection<VerificationChecklistView>((checklist) => checklist.name);
  const columns = useColumns(canWrite ? selection.column : null);
  const add = canWrite ? (
    <Button asChild>
      <Link to="/master-data/rca/checklists/new">
        <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
        Add checklist
      </Link>
    </Button>
  ) : undefined;
  const bulk = canWrite ? (
    <BulkRetireButton source={VERIFICATION_CHECKLISTS} ids={selection.selected} what="checklists" onDone={async () => (selection.clear(), refresh())} />
  ) : undefined;
  return (
    <MasterDataLayout title="Verification checklists" actions={add}>
      <ListToolbar compact filters={filters} onChange={update} searchLabel="Search checklists" />
      <RcaCard title="Checklists" info="Checks that confirm an RCA's fix worked; templates name the ones they need." actions={bulk} testId="rca-checklists">
        <DataTable
          caption="Verification checklists"
          columns={columns}
          rows={checklists.rows}
          getRowKey={(checklist) => checklist.id}
          onRowClick={(checklist) => navigate(`/master-data/rca/checklists/${checklist.id}`)}
          rowsHaveLink
          pager={checklists.pager}
          status={checklists.status}
          empty={{ title: 'No checklists', text: filters.q ? 'No checklist matches the search.' : 'No verification checklist with this status yet.' }}
        />
      </RcaCard>
    </MasterDataLayout>
  );
}
