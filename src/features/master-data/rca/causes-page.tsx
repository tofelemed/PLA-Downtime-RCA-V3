import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, ListPager, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { RcaCard } from '@/features/rca/components/rca-card';
import { useToast } from '@/hooks/use-toast';
import { ActionIcon } from '@/lib/icons';
import type { RcaCauseView } from '../api/master-data-types';
import { RCA_CAUSES } from '../api/record-resource';
import { useRecordLifecycle } from '../api/use-record-commands';
import { useRecordPage } from '../api/use-record-queries';
import { ImportExportButtons } from '../components/import-export-buttons';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { listQueryOf, useListFilters, type ListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRefreshRcaSettings } from '../hooks/use-refresh-rca-settings';
import { CauseActions, type CauseAction } from './cause-actions';
import { CauseDialogs, type PendingCause } from './cause-dialogs';
import { CauseNode } from './cause-node';
import { exportCauses, importCauses } from './rca-transfer';
import { RcaListToolbar } from './rca-list-toolbar';

const SORTS = { code: 'Code (A–Z)', name: 'Name (A–Z)' } as const;

interface ViewProps {
  filters: ListFilters;
  canWrite: boolean;
  onAction: (cause: RcaCauseView, action: CauseAction) => void;
}

/** Top-level causes, 20 per page; each opens to its sub-causes. */
function CauseTree({ filters, canWrite, onAction }: ViewProps) {
  const roots = useRecordPage<RcaCauseView>(RCA_CAUSES, { ...listQueryOf(filters), rootsOnly: true });
  if (roots.status.isLoading) return <DataState state="loading" />;
  if (roots.status.isError) return <DataState state="error" error={roots.status.error} onRetry={roots.status.onRetry} />;
  if (roots.rows.length === 0) return <DataState state="empty" detail="The cause library is empty for this status." />;
  return (
    <>
      <ul aria-label="Cause library" className="rounded-md border p-2">
        {roots.rows.map((cause) => (
          <CauseNode key={cause.id} cause={cause} depth={0} status={filters.status} canWrite={canWrite} onAction={onAction} />
        ))}
      </ul>
      <ListPager pager={roots.pager} label="Cause library pages" />
    </>
  );
}

/** Matching causes at any level, as a flat table. */
function CauseSearch({ filters, canWrite, onAction }: ViewProps) {
  const found = useRecordPage<RcaCauseView>(RCA_CAUSES, listQueryOf(filters));
  const columns: DataTableColumn<RcaCauseView>[] = [
    { id: 'code', header: 'Code', cell: (cause) => cause.code, nowrap: true },
    { id: 'name', header: 'Name', cell: (cause) => cause.name },
    { id: 'category', header: 'Category', cell: (cause) => cause.category ?? '—' },
    { id: 'status', header: 'Status', cell: (cause) => <RecordStatusBadge retired={!cause.isActive} /> },
    ...(canWrite ? [{ id: 'actions', header: '', headerLabel: 'Actions', align: 'right' as const, cell: (cause: RcaCauseView) => <CauseActions cause={cause} onAction={onAction} /> }] : []),
  ];
  return <DataTable caption="Matching causes" columns={columns} rows={found.rows} getRowKey={(cause) => cause.id} pager={found.pager} status={found.status} empty={{ title: 'No cause matches the search', text: 'No cause matches the search.' }} />;
}

/** `/master-data/rca/causes`: the RCA cause library as a lazily loaded tree; search lists matches flat. */
export function RcaCausesPage() {
  const { filters, update } = useListFilters();
  const canWrite = useMasterDataWriter();
  const refresh = useRefreshRcaSettings();
  const { toast } = useToast();
  const restore = useRecordLifecycle<RcaCauseView>(RCA_CAUSES, 'restore');
  const [pending, setPending] = useState<PendingCause | null>(null);
  const onAction = (cause: RcaCauseView, action: CauseAction) => {
    if (action === 'addChild') return setPending({ kind: 'add', parent: cause });
    if (action !== 'restore') return setPending({ kind: action, cause });
    restore.submit({ id: cause.id }).then(
      () => toast({ title: 'Cause restored' }),
      (error: unknown) => toast({ ...friendlyToastContent(error), variant: 'destructive' }),
    );
  };
  const importFile = async (file: File) => {
    const result = await importCauses(file);
    await refresh();
    return result;
  };
  const actions = (
    <>
      <ImportExportButtons what="RCA causes" onExport={exportCauses} onImport={canWrite ? importFile : undefined} />
      {canWrite && (
        <Button onClick={() => setPending({ kind: 'add', parent: null })}>
          <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
          Add cause
        </Button>
      )}
    </>
  );
  const view = { filters, canWrite, onAction };
  return (
    <MasterDataLayout title="Cause library" actions={actions}>
      <RcaListToolbar filters={filters} onChange={update} searchLabel="Search causes" sortLabels={SORTS} />
      <RcaCard title="Causes" info="Causes RCAs pick from, by category and as a tree." testId="rca-causes">
        {filters.q.trim() ? <CauseSearch {...view} /> : <CauseTree {...view} />}
      </RcaCard>
      <CauseDialogs pending={pending} onClose={() => setPending(null)} />
    </MasterDataLayout>
  );
}
