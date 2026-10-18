import type { ApprovalItem } from '@/api/v2/types/approvals';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ACTION_LABELS } from './approval-command';

/**
 * Separation of duties for the signed-in user, as the server decided it for this record: the decisions open to
 * them, the ones blocked and why (an author never approves their own request; SuperAdmin may), or that the
 * review is decided in its workspace.
 */
export function ApprovalEligibility({ item }: { item: ApprovalItem }) {
  const { isSuperAdmin } = useCapabilities();
  const open = item.actions.filter((action) => !action.disabledReason);
  const blocked = item.actions.filter((action) => action.disabledReason);
  return (
    <div className="space-y-2 text-sm" data-testid="approval-eligibility">
      {open.length > 0 && <p>You can decide here: {open.map((action) => ACTION_LABELS[action.action]).join(', ')}.</p>}
      {blocked.map((action) => (
        <p key={action.action}>
          <span className="font-medium">{ACTION_LABELS[action.action]} is not available to you:</span> {action.disabledReason}
        </p>
      ))}
      {item.actions.length === 0 && <p>This review is decided in its workspace, where its evidence and gates are checked.</p>}
      <p className="text-muted-foreground">
        {isSuperAdmin
          ? 'You are acting as SuperAdmin: you may decide for every approval role, including your own requests.'
          : 'Separation of duties: a different approver must decide a request you made.'}
      </p>
    </div>
  );
}
