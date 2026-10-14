import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDemandTransition } from '@/api/v2/queries/demand-statuses';
import type { DemandStatusView, RevaluationRequested } from '@/api/v2/types/valuation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';
import { RevaluationQueued } from '../components/revaluation-queued';

/**
 * Approve / retire one demand status (finance approvers only; the author sees approve disabled). The
 * server decides overlaps and separation of duties; the answer says which periods it revalues (SME V7).
 */
export function DemandActions({ status }: { status: DemandStatusView }) {
  const { canApproveValuation } = useCapabilities();
  const access = approvalAccess(canApproveValuation, status.createdBy, useCurrentUserId());
  const transition = useDemandTransition();
  const [queued, setQueued] = useState<RevaluationRequested | null>(null);
  if (status.state === 'retired' || !canApproveValuation) return <RevaluationQueued revaluation={queued} />;
  const run = async (action: 'approve' | 'retire') => {
    const result = await transition.submit({ id: status.id, action, supersede: false }).catch(() => null);
    setQueued(result?.revaluation ?? null);
  };
  return (
    <div className="space-y-1" data-testid="demand-actions">
      <div className="flex flex-wrap gap-2">
        {status.state === 'draft' && (
          <ApproveButton access={access} size="sm" onClick={() => void run('approve')} disabled={transition.isPending} data-testid="demand-approve">
            Approve
          </ApproveButton>
        )}
        <Button size="sm" variant="ghost" onClick={() => void run('retire')} disabled={transition.isPending}>
          Retire
        </Button>
      </div>
      <FinanceRefusalAlert error={transition.error} />
      <RevaluationQueued revaluation={queued} />
    </div>
  );
}
