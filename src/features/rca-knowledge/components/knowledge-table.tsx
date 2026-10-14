import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { RcaKnowledgeFilters } from '@/api/v2/queries/rca-knowledge';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { v2 } from '@/api/v2/v2';
import { DataTable, type DataTableColumn, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { useRcaFormat } from '@/features/rca/use-rca-format';
import { QualityBadge } from './quality-score';

function usePrefetchEntry() {
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  return useCallback(
    (id: string) => {
      if (!tenantId) return;
      void client.prefetchQuery({
        queryKey: v2Keys.detail(tenantId, 'rca-knowledge', id),
        staleTime: STALE_TIME['rca-knowledge'],
        queryFn: async ({ signal }) => (await v2.get<RcaKnowledgeView, '/api/v2/rca-knowledge/{id}'>('/api/v2/rca-knowledge/{id}', { path: { id }, signal })).data,
      });
    },
    [client, tenantId],
  );
}

function columns(date: (iso: string | null) => string, prefetch: (id: string) => void): DataTableColumn<RcaKnowledgeView>[] {
  return [
    {
      id: 'title',
      header: 'Entry',
      cell: (row) => (
        <span onMouseEnter={() => prefetch(row.id)}>
          <span className="block font-medium">{row.title}</span>
          {row.rootCause && <span className="line-clamp-1 text-xs text-muted-foreground">{row.rootCause}</span>}
        </span>
      ),
    },
    { id: 'quality', header: 'Quality', cell: (row) => <QualityBadge score={row.qualityScore} />, nowrap: true },
    { id: 'published', header: 'State', cell: (row) => <Badge variant={row.isPublished ? 'default' : 'outline'}>{row.isPublished ? 'Published' : 'Unpublished'}</Badge>, nowrap: true },
    { id: 'unit', header: 'Unit', cell: (row) => row.unitName ?? (row.unitId ? 'Unknown unit' : 'Tenant-wide') },
    { id: 'asset', header: 'Asset', cell: (row) => row.assetName ?? '—' },
    { id: 'helpful', header: 'Helpful', cell: (row) => row.helpfulCount, align: 'right' },
    { id: 'closed', header: 'Closed', cell: (row) => date(row.closedAt ?? row.createdAt), nowrap: true },
  ];
}

/** Knowledge entries as server pages of 20, newest first; a row opens the entry. */
export function KnowledgeTable({ filters, empty }: { filters: RcaKnowledgeFilters; empty: DataTableEmpty }) {
  const navigate = useNavigate();
  const { date } = useRcaFormat();
  const prefetch = usePrefetchEntry();
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
  const paged = usePagedQuery<RcaKnowledgeView>({ resource: 'rca-knowledge', path: '/rca-knowledge', query, key: { filters: query } });
  const cols = useMemo(() => columns(date, prefetch), [date, prefetch]);
  return (
    <div data-testid="knowledge-list">
      <DataTable
        caption="Knowledge entries"
        columns={cols}
        rows={paged.rows}
        getRowKey={(row) => row.id}
        pager={paged.pager}
        status={paged.status}
        empty={empty}
        onRowClick={(row) => navigate(`/rca-knowledge-base/${row.id}`)}
        rowLabel={(row) => `Open entry ${row.title}`}
      />
    </div>
  );
}
