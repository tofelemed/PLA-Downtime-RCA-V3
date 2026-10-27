import { useDecideLossAccountingVersion } from '@/api/v2/queries/loss-accounting';
import type { LossAccountingVersionView } from '@/api/v2/types/loss-accounting';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ReasonConfirm } from '@/features/plan-dashboard/workflow/reason-confirm';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';

/**
 * Approve / reject a proposed loss accounting version (production accounting or the manager, never its author).
 * The reject reason is required; the server's refusal (e.g. separation of duties) is shown as it is.
 */
export function LossAccountingVersionActions({ version }: { version: LossAccountingVersionView }) {
  const { canApproveLossAccounting, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const decide = useDecideLossAccountingVersion();
  if (version.state !== 'proposed') return null;
  const access = approvalAccess(canApproveLossAccounting, version.createdBy, userId, isSuperAdmin);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <ApproveButton access={access} size="sm" disabled={decide.isPending} data-testid="loss-approve" onClick={() => void decide.submit({ id: version.id, decision: 'approve' }).catch(() => undefined)}>
          Approve version {version.version}
        </ApproveButton>
        {access !== 'hidden' && (
          <ReasonConfirm
            trigger="Reject…"
            triggerTestId="loss-reject"
            disabled={decide.isPending || access !== 'allowed'}
            title="Reject this version?"
            description="The author sees your reason; the version in force stays as it is."
            confirmLabel="Reject version"
            destructive
            onConfirm={(reason) => decide.submit({ id: version.id, decision: 'reject', reason })}
          />
        )}
      </div>
      {decide.error !== null && <FriendlyErrorAlert error={decide.error} title="The decision was not saved" />}
    </div>
  );
}
