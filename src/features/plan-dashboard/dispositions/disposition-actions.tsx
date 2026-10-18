import type { LotDispositionView } from '@/api/v2/types/periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useDecideDisposition } from '../hooks/use-disposition-commands';
import { ReasonConfirm } from '../workflow/reason-confirm';

/** Approve or reject a proposed lot disposition: Quality / Lab approvers only, never its author. */
export function DispositionActions({ disposition }: { disposition: LotDispositionView }) {
  const approve = useDecideDisposition('approve');
  const reject = useDecideDisposition('reject');
  const { isSuperAdmin } = useCapabilities();
  const access = approvalAccess(true, disposition.authorId, useCurrentUserId(), isSuperAdmin);
  const busy = approve.isPending || reject.isPending;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <ApproveButton access={access} size="sm" disabled={busy} data-testid="disposition-approve" onClick={() => void approve.submit({ id: disposition.id }).catch(() => undefined)}>
          Approve
        </ApproveButton>
        <ReasonConfirm
          trigger="Reject…"
          triggerTestId="disposition-reject"
          disabled={busy || access !== 'allowed'}
          title="Reject this disposition?"
          description="The period actuals stay as they are; the author sees your reason."
          confirmLabel="Reject disposition"
          destructive
          onConfirm={(reason) => reject.submit({ id: disposition.id, reason })}
        >
          {reject.error !== null && <FriendlyErrorAlert error={reject.error} />}
        </ReasonConfirm>
      </div>
      {approve.error !== null && <FriendlyErrorAlert error={approve.error} title="Could not approve the disposition" />}
    </div>
  );
}
