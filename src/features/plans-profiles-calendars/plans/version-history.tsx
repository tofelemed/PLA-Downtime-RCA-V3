import { usePlanVersions } from '@/api/v2/queries/plans';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { BASIS_SHORT_LABELS, DISTRIBUTION_LABELS, labelOf, useUserNames } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '../components/version-state-badge';

/** Versions newest first with approval, supersession and change reasons (plan history), 20 per page. */
export function VersionHistory({ planId, timezone }: { planId: string; timezone: string }) {
  const versions = usePlanVersions(planId);
  const users = useUserNames();
  const items = flattenPages(versions.data?.pages);
  const numberOf = new Map(items.map((v) => [v.id, v.version]));
  const columns: DataTableColumn<PlanVersionView>[] = [
    { id: 'version', header: 'Version', nowrap: true, cell: (v) => <span data-testid="history-row" data-version={v.version} data-state={v.approvalState}>Version {v.version}</span> },
    { id: 'state', header: 'State', cell: (v) => <VersionStateBadge state={v.approvalState} /> },
    { id: 'content', header: 'Content', cell: (v) => `${labelOf(BASIS_SHORT_LABELS, v.basis)} · ${labelOf(DISTRIBUTION_LABELS, v.distribution)}${v.headerTarget ? ` · header ${v.headerTarget}` : ''}` },
    {
      id: 'approved',
      header: 'Approved',
      nowrap: true,
      cell: (v) => (v.approvedAt ? <span className="text-xs"><PlantTime iso={v.approvedAt} tz={timezone} withDate /> · {users.nameOf(v.approvedBy)}</span> : '—'),
    },
    { id: 'supersedes', header: 'Replaces', cell: (v) => (v.supersedesVersionId ? `Version ${numberOf.get(v.supersedesVersionId) ?? 'earlier'}` : '—') },
    { id: 'reason', header: 'Change reason', cell: (v) => v.changeReason ?? '—' },
  ];
  return (
    <Section title="Version history">
      <div data-testid="version-history">
        <DataTable
          caption="Plan versions"
          columns={columns}
          rows={items}
          getRowKey={(v) => v.id}
          status={{ isLoading: versions.isLoading, isError: versions.isError, error: versions.error, onRetry: () => void versions.refetch() }}
          empty={{ text: 'No versions yet.' }}
        />
      </div>
    </Section>
  );
}
