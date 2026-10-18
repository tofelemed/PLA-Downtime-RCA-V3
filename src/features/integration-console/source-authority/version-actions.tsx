import { useDecideSourceAuthorityVersion } from '@/api/v2/queries/source-authority';
import type { SourceAuthorityVersionView } from '@/api/v2/types/source-authority';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ReasonConfirm } from '@/features/plan-dashboard/workflow/reason-confirm';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';

/**
 * Approve / reject a draft source authority version (production accounting, never its author). Approval
 * puts it in force from now; periods already calculated keep their version until recalculated.
 */
export function VersionActions({ version }: { version: SourceAuthorityVersionView }) {
  const { canApproveSourceAuthority, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const decide = useDecideSourceAuthorityVersion();
  if (version.state !== 'proposed') return null;
  const access = approvalAccess(canApproveSourceAuthority, version.createdBy, userId, isSuperAdmin);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <ApproveButton access={access} size="sm" disabled={decide.isPending} data-testid="authority-approve" onClick={() => void decide.submit({ id: version.id, decision: 'approve' }).catch(() => undefined)}>
          Approve version {version.version}
        </ApproveButton>
        {access !== 'hidden' && (
          <ReasonConfirm
            trigger="Reject…"
            triggerTestId="authority-reject"
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
