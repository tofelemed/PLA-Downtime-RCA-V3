import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDemandTransition } from '@/api/v2/queries/demand-statuses';
import type { DemandStatusView, RevaluationRequested } from '@/api/v2/types/valuation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';
import { RevaluationQueued } from '../components/revaluation-queued';

type DemandAction = 'approve' | 'retire';

const DONE: Record<DemandAction, string> = { approve: 'Demand status approved', retire: 'Demand status retired' };

/**
 * Approve / retire one demand status (finance approvers only; the author sees approve disabled). Retire asks
 * first; success is a toast. A refusal shows in plain words where the action was taken (the row for approve,
 * the dialog for retire). The server decides overlaps and separation of duties; the answer says which
 * periods it revalues (SME V7).
 */
export function DemandActions({ status }: { status: DemandStatusView }) {
  const { canApproveValuation, isSuperAdmin } = useCapabilities();
  const access = approvalAccess(canApproveValuation, status.createdBy, useCurrentUserId(), isSuperAdmin);
  const transition = useDemandTransition();
  const { toast } = useToast();
  const [queued, setQueued] = useState<RevaluationRequested | null>(null);
  const [retiring, setRetiring] = useState(false);
  if (status.state === 'retired' || !canApproveValuation) return <RevaluationQueued revaluation={queued} />;
  const run = async (action: DemandAction) => {
    const result = await transition.submit({ id: status.id, action, supersede: false });
    setQueued(result.revaluation ?? null);
    toast({ title: DONE[action] });
  };
  const onRetireOpenChange = (next: boolean) => {
    setRetiring(next);
    transition.reset();
  };
  return (
    <div className="space-y-1" data-testid="demand-actions">
      <div className="flex flex-wrap gap-2">
        {status.state === 'draft' && (
          <ApproveButton access={access} size="sm" onClick={() => void run('approve').catch(() => undefined)} disabled={transition.isPending} data-testid="demand-approve">
            Approve
          </ApproveButton>
        )}
        <Button size="sm" variant="ghost" onClick={() => onRetireOpenChange(true)} disabled={transition.isPending} data-testid="demand-retire">
          Retire…
        </Button>
      </div>
      <ConfirmDialog
        open={retiring}
        onOpenChange={onRetireOpenChange}
        title="Retire this demand status?"
        description="A retired status is no longer used by the economic view. It stays in the history and cannot be approved again."
        confirmLabel="Retire status"
        destructive
        onConfirm={() => run('retire')}
      >
        {transition.error ? <FinanceRefusalAlert error={transition.error} /> : null}
      </ConfirmDialog>
      {!retiring && <FinanceRefusalAlert error={transition.error} />}
      <RevaluationQueued revaluation={queued} />
    </div>
  );
}
