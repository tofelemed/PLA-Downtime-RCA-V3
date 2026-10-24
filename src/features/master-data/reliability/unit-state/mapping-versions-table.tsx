import type { PagedQueryResult } from '@/api/v2/queries/use-paged-query';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { STATE_LABELS } from './mapping-editor-model';

function columnsOf(format: ReliabilityFormat): DataTableColumn<UnitStateMappingView>[] {
  return [
    { id: 'version', header: 'Version', cell: (m) => format.number(m.version), nowrap: true },
    { id: 'rules', header: 'Signal value → state', cell: (m) => m.rules.map((r) => `${r.match} → ${STATE_LABELS[r.state]}`).join('; ') },
    {
      id: 'stale',
      header: 'Stale after',
      cell: (m) => (m.staleAfterSeconds === null ? 'Exception-based (never stale)' : format.duration(m.staleAfterSeconds)),
    },
    { id: 'from', header: 'From', cell: (m) => format.dateTime(m.effectiveFrom), nowrap: true },
    { id: 'to', header: 'Until', cell: (m) => (m.effectiveTo ? format.dateTime(m.effectiveTo) : 'In force'), nowrap: true },
    { id: 'notes', header: 'Notes', cell: (m) => m.notes ?? '—' },
  ];
}

/** Versions of a unit's state mapping, newest first (each version keeps its own rules and staleness). */
export function MappingVersionsTable({ page, format }: { page: PagedQueryResult<UnitStateMappingView>; format: ReliabilityFormat }) {
  return (
    <DataTable
      caption="State mapping versions"
      columns={columnsOf(format)}
      rows={page.rows}
      pager={page.pager}
      getRowKey={(m) => m.id}
      status={page.status}
      empty={{ title: 'No state mapping yet', text: 'No state mapping yet; without one the unit has no state timeline or availability bounds.' }}
    />
  );
}
