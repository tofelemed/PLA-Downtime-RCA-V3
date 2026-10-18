import type { ApprovalItem } from '@/api/v2/types/approvals';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ACTION_LABELS } from './approval-command';

/**
 * Why the signed-in user can or cannot decide, as the server read it for this record: the decisions open
 * to them, the ones blocked and why (an author never approves their own request; SuperAdmin may). The
 * decision command checks every gate again.
 */
export function ApprovalEligibility({ item }: { item: ApprovalItem }) {
  const { isSuperAdmin } = useCapabilities();
  const open = item.actions.filter((action) => !action.disabledReason);
  const blocked = item.actions.filter((action) => action.disabledReason);
  const workflow = item.actions.length === 0;
  return (
    <div className="space-y-2 text-sm" data-testid="approval-eligibility" data-can-decide={item.canDecide}>
      {open.length > 0 && <p>You can decide here: {open.map((action) => ACTION_LABELS[action.action]).join(', ')}.</p>}
      {blocked.map((action) => (
        <p key={action.action}>
          <span className="font-medium">{ACTION_LABELS[action.action]} is not available to you:</span> {action.disabledReason}
        </p>
      ))}
      {workflow && item.canDecide && <p>You can decide here. The form below has the same checks and confirmations as the workspace.</p>}
      {workflow && !item.canDecide && (
        <p>
          <span className="font-medium">You cannot decide this record:</span> {item.decisionBlockedReason}
        </p>
      )}
      <p className="text-muted-foreground">
        {isSuperAdmin
          ? 'You are acting as SuperAdmin: you may decide for every approval role, including your own requests.'
          : 'Separation of duties: a different approver must decide a request you made. The server checks every rule again when you decide.'}
      </p>
    </div>
  );
}
