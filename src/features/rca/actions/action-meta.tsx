import { useCapabilities } from '@/features/auth/use-capabilities';
import type { RcaActionView } from '@/api/v2/types/rca';
import { currencyDigits } from '@/features/display-currency/money-format';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_TYPE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';
import { isActionOverdue } from '../model/due-date';
import { useRcaFormat } from '../use-rca-format';

/** "Overdue" in words with an icon: the due day has passed and the action is neither done nor cancelled. */
export function ActionOverdueBadge({ action }: { action: Pick<RcaActionView, 'dueDate' | 'status'> }) {
  const { timezone } = useRcaFormat();
  if (!isActionOverdue(action, timezone)) return null;
  return (
    <StatusBadge tone="danger" icon={StatusIcon.warning} data-testid="action-overdue">
      Overdue
    </StatusBadge>
  );
}

/** Type, owner, due day (with the overdue badge), verifier and verification method, and the owner's claim of one action. */
export function ActionMeta({ action }: { action: RcaActionView }) {
  const users = useUserNames([action.ownerId, action.verifierId].filter((id): id is string => Boolean(id)));
  const { day } = useRcaFormat();
  // QA re-test N1: the claim is money (the server leaves it out for operators as well)
  const { canViewMoney } = useCapabilities();
  const claim = canViewMoney ? action.claimedAvoidedLoss : null;
  return (
    <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-muted-foreground" data-testid="action-meta">
      <span>
        {action.actionType ? `${labelOf(RCA_ACTION_TYPE_LABELS, action.actionType)} · ` : 'Type not chosen · '}
        {action.ownerId ? `owner ${users.nameOf(action.ownerId)} · ` : 'no owner · '}
        {action.dueDate ? `due ${day(action.dueDate)}` : 'no due date'}
        {action.verifierId ? ` · verifier ${users.nameOf(action.verifierId)}` : ''}
        {action.verificationMethod ? ` · verified by: ${action.verificationMethod}` : ''}
        {claim && (
          <>
            {' '}· claimed <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} />
          </>
        )}
      </span>
      <ActionOverdueBadge action={action} />
    </p>
  );
}
