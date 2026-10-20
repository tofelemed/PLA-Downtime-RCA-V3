import { useApprovalActions } from '@/api/v2/queries/period-overview';
import type { ApprovalActionView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, REVISION_LIFECYCLE_LABELS, useUserNames, WORKFLOW_ACTION_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { actorLabel } from '../model/display';
import { ChangeProposalsPanel } from './change-proposals-panel';
import { ExportPanel } from './export-panel';

export interface PeriodHistoryProps {
  view: ReconciliationView;
  timezone: string;
}

const ACTION_LABELS: Readonly<Record<string, string>> = {
  ...WORKFLOW_ACTION_LABELS,
  revise: 'Reopened for revision',
  create: 'Draft created',
  accept_proposal: 'Change proposal accepted',
  dismiss_proposal: 'Change proposal dismissed',
};

/** Revision history (approval actions, newest first), open change proposals and the approved export. */
export function PeriodHistory({ view, timezone }: PeriodHistoryProps) {
  const actions = useApprovalActions(view.periodId);
  const users = useUserNames();
  const userId = useCurrentUserId();
  const columns: DataTableColumn<ApprovalActionView>[] = [
    { id: 'at', header: 'When', nowrap: true, cell: (a) => <PlantTime iso={a.at} tz={timezone} withDate /> },
    {
      id: 'action',
      header: 'Action',
      cell: (a) => (
        <span className="flex flex-wrap items-center gap-1">
          <span data-testid="history-action" data-action={a.action}>{labelOf(ACTION_LABELS, a.action)}</span>
          <SelfDecisionBadge selfDecided={a.selfDecided} kind={a.action === 'approve' ? 'approved' : 'decided'} />
        </span>
      ),
    },
    { id: 'change', header: 'State', cell: (a) => `${labelOf(REVISION_LIFECYCLE_LABELS, a.fromLifecycle)} → ${labelOf(REVISION_LIFECYCLE_LABELS, a.toLifecycle)}` },
    { id: 'by', header: 'By', cell: (a) => actorLabel(a.actorId, userId, users.nameOf, a.service) },
    { id: 'reason', header: 'Reason', cell: (a) => a.reason ?? '—' },
  ];
  return (
    <div className="space-y-6">
      <Section title="Revision history" headingLevel={3}>
        <div data-testid="revision-history">
          <DataTable
            caption="Revision history"
            columns={columns}
            rows={actions.data?.items ?? []}
            getRowKey={(a) => a.id}
            status={{ isLoading: actions.isLoading, isError: actions.isError, error: actions.error }}
            empty={{ text: 'No workflow actions yet.' }}
            density="compact"
          />
        </div>
      </Section>
      <ChangeProposalsPanel view={view} timezone={timezone} />
      {view.revision.lifecycle === 'approved' && <ExportPanel view={view} timezone={timezone} />}
    </div>
  );
}
