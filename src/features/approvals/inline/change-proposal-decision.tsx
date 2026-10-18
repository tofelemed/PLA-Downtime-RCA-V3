import { useChangeProposals, useReconciliation } from '@/api/v2/queries/period-overview';
import { useProposalDecision } from '@/api/v2/queries/period-workflow';
import type { ChangeProposalView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { EditorProblem } from '@/features/plan-dashboard/editor/editor-problem';
import { useCommandProblem } from '@/features/plan-dashboard/hooks/use-command-problem';
import { periodRefOf } from '@/features/plan-dashboard/hooks/use-draft-editor';
import { ChangeProposalCard } from '@/features/plan-dashboard/workflow/change-proposals-panel';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import type { InlineFormProps } from './inline-form-props';
import type { OnDecided } from './use-decided-when';

const DECIDED = { accept: 'Change accepted: a new draft revision is open', dismiss: 'Change dismissed' } as const;

function Decide({ view, proposal, onDecided }: { view: ReconciliationView; proposal: ChangeProposalView; onDecided: OnDecided }) {
  const { canApproveRevisions, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const { timezone } = usePlantTimezone();
  const decision = useProposalDecision();
  const { problem, track } = useCommandProblem();
  const mayDecide = (canApproveRevisions || isSuperAdmin) && (isSuperAdmin || proposal.manual?.proposedBy !== userId);
  const decide = (p: ChangeProposalView, d: 'accept' | 'dismiss', reason: string) =>
    track(decision.submit({ period: periodRefOf(view), proposalId: p.id, decision: d, reason })).then(() => onDecided(DECIDED[d]));
  return (
    <div className="space-y-2" data-testid="inline-change-proposal">
      <ChangeProposalCard p={proposal} timezone={timezone} decide={mayDecide ? decide : null} />
      {!mayDecide && !proposal.manual && <p className="text-sm text-muted-foreground">Change proposals are decided by plant management or production accounting.</p>}
      {problem && <EditorProblem problem={problem} />}
    </div>
  );
}

/** An approved period's change proposal on the approval page: before / after, then accept or dismiss with a reason. */
export function ChangeProposalDecision({ item, onDecided }: InlineFormProps) {
  const reconciliation = useReconciliation(item.target.periodId);
  const proposals = useChangeProposals(item.target.periodId);
  const proposal = proposals.data?.items.find((p) => p.id === item.id);
  const view = reconciliation.data;
  return (
    <DataState state={dataStateOf(proposals.isSuccess ? reconciliation : proposals)} error={reconciliation.error ?? proposals.error} onRetry={() => void proposals.refetch()}>
      {view && proposal && <Decide view={view} proposal={proposal} onDecided={onDecided} />}
      {view && proposals.isSuccess && !proposal && <p className="text-sm">This proposal is not open on the period any more.</p>}
    </DataState>
  );
}
