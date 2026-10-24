import type { ReactNode } from 'react';
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

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
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
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 xl:grid-cols-6" data-testid="action-meta">
      <MetaItem label="Type">{action.actionType ? labelOf(RCA_ACTION_TYPE_LABELS, action.actionType) : 'Not chosen'}</MetaItem>
      <MetaItem label="Owner">{action.ownerId ? users.nameOf(action.ownerId) : 'No owner'}</MetaItem>
      <MetaItem label="Due">
        <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
          {action.dueDate ? day(action.dueDate) : 'No due date'}
          <ActionOverdueBadge action={action} />
        </span>
      </MetaItem>
      <MetaItem label="Verifier">{action.verifierId ? users.nameOf(action.verifierId) : '—'}</MetaItem>
      <MetaItem label="Verification method">{action.verificationMethod || '—'}</MetaItem>
      {claim && (
        <MetaItem label="Claimed avoided loss">
          <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} />
        </MetaItem>
      )}
    </dl>
  );
}
