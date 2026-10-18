import { useReconciliation } from '@/api/v2/queries/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ReconciliationSummary } from '@/features/plan-dashboard/components/reconciliation-summary';
import { EditorProblem } from '@/features/plan-dashboard/editor/editor-problem';
import { useWorkflowActions } from '@/features/plan-dashboard/hooks/use-workflow-actions';
import { approveGate, reviewGate } from '@/features/plan-dashboard/model/display';
import { ApproveRevisionDialog } from '@/features/plan-dashboard/workflow/approve-revision-dialog';
import { BridgeReviewPanel } from '@/features/plan-dashboard/workflow/bridge-review-panel';
import { RejectDialog } from '@/features/plan-dashboard/workflow/reject-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { InlineFormProps } from './inline-form-props';
import type { OnDecided } from './use-decided-when';

/** a refused command keeps its dialog open (the problem is shown in it) */
const orKeepOpen = (done: Promise<boolean>, onDone: () => void) =>
  done.then((ok) => (ok ? onDone() : Promise.reject(new Error('refused'))));

function ReviewButtons({ view, onDecided }: { view: ReconciliationView; onDecided: OnDecided }) {
  const userId = useCurrentUserId();
  const { isSuperAdmin, canApproveRevisions } = useCapabilities();
  const actions = useWorkflowActions(view);
  const review = reviewGate(view, userId, isSuperAdmin);
  const approve = approveGate(view, userId, isSuperAdmin);
  const access = approvalAccess(canApproveRevisions, view.revision.submittedBy, userId, isSuperAdmin);
  const busy = actions.pending !== null;
  const problem = actions.problem && <EditorProblem problem={actions.problem} />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ApproveRevisionDialog view={view} access={access} disabled={busy || !approve.allowed} describedBy={approve.reason ? 'inline-approve-gate' : undefined}
          onConfirm={(comment) => orKeepOpen(actions.approve(comment), () => onDecided('Revision approved'))}>
          {problem}
        </ApproveRevisionDialog>
        <RejectDialog view={view} disabled={busy || !review.allowed} onConfirm={(reason, failed) => orKeepOpen(actions.reject(reason, failed), () => onDecided('Revision returned to its preparer'))}>
          {problem}
        </RejectDialog>
      </div>
      {approve.reason && <p id="inline-approve-gate" className="text-sm" data-testid="approve-gate" data-code={approve.code ?? ''}>{approve.reason}</p>}
      {problem}
    </div>
  );
}

/**
 * Period revision review on the approval page: the reconciliation equation the approver signs, the second
 * (bridge) review where the policy asks for one, and approve / reject with the workspace's own dialogs,
 * gates and separation-of-duties checks (the server decides).
 */
export function PeriodReviewDecision({ item, onDecided }: InlineFormProps) {
  const { canApproveRevisions, isSuperAdmin } = useCapabilities();
  const query = useReconciliation(item.target.periodId);
  const view = query.data;
  if (!canApproveRevisions && !isSuperAdmin) return <p className="text-sm">Period revisions are approved by plant management or production accounting.</p>;
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {view && view.revision.id !== item.id && <p className="text-sm">This period has a newer revision. Open the workspace to review it.</p>}
      {view && view.revision.id === item.id && (
        <div className="space-y-4" data-testid="inline-period-review">
          <ReconciliationSummary view={view} />
          <BridgeReviewPanel view={view} />
          <ReviewButtons view={view} onDecided={onDecided} />
        </div>
      )}
    </DataState>
  );
}
