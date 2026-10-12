import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import type { RcaTemplateView } from '../api/master-data-types';
import { RCA_TEMPLATES } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { BulkRetireButton } from '../components/bulk-retire-button';
import { ImportExportButtons } from '../components/import-export-buttons';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRefreshRcaSettings } from '../hooks/use-refresh-rca-settings';
import { useRowSelection } from '../hooks/use-row-selection';
import { exportTemplates, importTemplates } from './rca-transfer';

const SORTS = { name: 'Name (A–Z)', '-createdAt': 'Newest first' } as const;

function useColumns(selectColumn: DataTableColumn<RcaTemplateView> | null): DataTableColumn<RcaTemplateView>[] {
  const prefetch = usePrefetchRecord(RCA_TEMPLATES);
  return [
    ...(selectColumn ? [selectColumn] : []),
    {
      id: 'name',
      header: 'Name',
      cell: (template) => (
        <RecordLink to={`/master-data/rca/templates/${template.id}`} onPrefetch={() => prefetch(template.id)}>
          {template.name}
        </RecordLink>
      ),
    },
    { id: 'category', header: 'Category', cell: (template) => template.category ?? '—' },
    { id: 'nodes', header: 'Logic tree nodes', align: 'right', cell: (template) => template.nodeCount },
    { id: 'checklists', header: 'Checklists', align: 'right', cell: (template) => template.checklistIds.length },
    { id: 'status', header: 'Status', cell: (template) => <RecordStatusBadge retired={!template.isActive} /> },
  ];
}

/** `/master-data/rca/templates`: RCA templates of the plant, 20 per page; export / import JSON; bulk retire. */
export function RcaTemplatesPage() {
  const { filters, update } = useListFilters('name');
  const canWrite = useMasterDataWriter();
  const refresh = useRefreshRcaSettings();
  const templates = useRecordPage<RcaTemplateView>(RCA_TEMPLATES, listQueryOf(filters));
  const selection = useRowSelection<RcaTemplateView>((template) => template.name);
  const columns = useColumns(canWrite ? selection.column : null);
  const importFile = async (file: File) => {
    const result = await importTemplates(file);
    await refresh();
    return result;
  };
  const actions = (
    <>
      <ImportExportButtons what="RCA templates" onExport={exportTemplates} onImport={canWrite ? importFile : undefined} />
      {canWrite && (
        <Button asChild>
          <Link to="/master-data/rca/templates/new">
            <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
            Add template
          </Link>
        </Button>
      )}
    </>
  );
  const bulk = canWrite ? (
    <BulkRetireButton source={RCA_TEMPLATES} ids={selection.selected} what="templates" onDone={async () => (selection.clear(), refresh())} />
  ) : undefined;
  return (
    <MasterDataLayout title="RCA templates" description="Logic trees and verification checklists an RCA can start from." actions={actions}>
      <Section title="Templates" actions={bulk}>
        <ListToolbar filters={filters} onChange={update} searchLabel="Search templates" sortLabels={SORTS} />
        <DataTable
          caption="RCA templates"
          columns={columns}
          rows={templates.rows}
          getRowKey={(template) => template.id}
          pager={templates.pager}
          status={templates.status}
          empty={{ title: 'No templates', text: filters.q ? 'No template matches the search.' : 'No RCA template with this status yet.' }}
        />
      </Section>
    </MasterDataLayout>
  );
}
