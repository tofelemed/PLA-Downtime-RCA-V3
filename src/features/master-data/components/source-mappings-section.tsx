import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { SourceMappingView } from '@/api/v2/types/integration-mappings';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, MATCH_KIND_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';

const MAPPINGS_INFO = 'Source ids and PI elements that resolve to this record. A SuperAdmin edits the rules in the integration console.';

const COLUMNS: DataTableColumn<SourceMappingView>[] = [
  { id: 'system', header: 'Source system', cell: (mapping) => mapping.sourceSystem, nowrap: true },
  { id: 'kind', header: 'Matched by', cell: (mapping) => labelOf(MATCH_KIND_LABELS, mapping.matchKind) },
  { id: 'value', header: 'Source value', cell: (mapping) => <span className="break-all font-mono text-xs">{mapping.matchValue}</span> },
  {
    id: 'state',
    header: 'State',
    cell: (mapping) => <Badge variant={mapping.isActive ? 'secondary' : 'outline'} className="whitespace-nowrap">{mapping.isActive ? 'Active' : 'Inactive'}</Badge>,
  },
];

/**
 * Which data-source rules point at this unit or asset (PI AF bindings included) — the v2 replacement of the
 * v1 "PI bound" badge. Read-only here; rules are edited in the integration console.
 */
export function SourceMappingsSection({ targetId }: { targetId: string }) {
  const { canReachIntegration } = useCapabilities();
  const mappings = usePagedQuery<SourceMappingView>({
    resource: 'source-mappings',
    path: '/source-mappings',
    query: { targetId, includeInactive: true },
    key: { filters: { targetId, includeInactive: true } },
  });
  return (
    <Section
      title="Data source mappings"
      headingLevel={2}
      collapsible
      defaultOpen={false}
      titleAside={<KpiInfo label="Data source mappings" text={MAPPINGS_INFO} />}
      actions={
        canReachIntegration ? (
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link to="/connectivity">Open integration console</Link>
          </Button>
        ) : undefined
      }
    >
      <DataTable
        caption="Data source mappings"
        columns={COLUMNS}
        rows={mappings.rows}
        getRowKey={(mapping) => mapping.id}
        pager={mappings.pager}
        status={mappings.status}
        empty={{ title: 'No mappings', text: 'No data source rule points at this record.' }}
      />
    </Section>
  );
}
