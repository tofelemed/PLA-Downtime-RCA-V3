import type { PeriodAdjustmentView } from '@/api/v2/types/periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { ReasonConfirm } from '../workflow/reason-confirm';
import { useDecideAdjustment } from '../hooks/use-adjustment-commands';

/** Approve or reject a proposed adjustment: manager approvers only, never its author (separation of duties). */
export function AdjustmentActions({ adjustment }: { adjustment: PeriodAdjustmentView }) {
  const approve = useDecideAdjustment('approve');
  const reject = useDecideAdjustment('reject');
  const { isSuperAdmin } = useCapabilities();
  const access = approvalAccess(true, adjustment.authorId, useCurrentUserId(), isSuperAdmin);
  const busy = approve.isPending || reject.isPending;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <ApproveButton access={access} size="sm" disabled={busy} data-testid="adjustment-approve" onClick={() => void approve.submit({ id: adjustment.id }).catch(() => undefined)}>
          Approve
        </ApproveButton>
        <ReasonConfirm
          trigger="Reject…"
          triggerTestId="adjustment-reject"
          disabled={busy || access !== 'allowed'}
          title="Reject this adjustment?"
          description="The actuals stay as measured; the author sees your reason."
          confirmLabel="Reject adjustment"
          destructive
          onConfirm={(reason) => reject.submit({ id: adjustment.id, reason })}
        >
          {reject.error !== null && <FriendlyErrorAlert error={reject.error} />}
        </ReasonConfirm>
      </div>
      {approve.error !== null && <FriendlyErrorAlert error={approve.error} title="Could not approve the adjustment" />}
    </div>
  );
}
