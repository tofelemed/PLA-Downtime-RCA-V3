import { useUpdateRcaAction, useVerifyRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currencyDigits } from '@/features/display-currency/money-format';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_STATUS_LABELS, RCA_BASELINE_METRIC_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { verificationLabel } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';

const STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;

function Baseline({ action }: { action: RcaActionView }) {
  if (!action.baseline) return <>no baseline</>;
  const { value, metric, windowDays, declared } = action.baseline;
  return (
    <>
      baseline {value} {labelOf(RCA_BASELINE_METRIC_LABELS, metric).toLowerCase()} over {windowDays} days ({declared ? 'declared' : 'counted from history'})
    </>
  );
}

/** One action: owner, status, due, verification state and — once verified — the realized difference. */
export function ActionRow({ action }: { action: RcaActionView; timezone?: string }) {
  const { canWriteRca } = useCapabilities();
  const users = useUserNames();
  const { day } = useRcaFormat();
  const update = useUpdateRcaAction();
  const verify = useVerifyRcaAction();
  const setStatus = (status: (typeof STATUSES)[number]) => void update.submit({ action, body: { status } }).catch(() => null);
  return (
    <li className="space-y-1 p-2 text-sm" data-testid="action-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{action.title}</span>
        <div className="flex items-center gap-2">
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label={`Status of ${action.title}`}
            value={action.status}
            disabled={!canWriteRca}
            onChange={(e) => setStatus(STATUSES.find((s) => s === e.target.value) ?? 'open')}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {RCA_ACTION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <Badge variant="outline" data-testid="verification-status">
            {verificationLabel(action.verificationStatus)}
          </Badge>
          {action.verificationStatus === 'due' && canWriteRca && (
            <Button size="sm" disabled={verify.isPending} onClick={() => void verify.submit(action).catch(() => null)} data-testid="verify-action">
              Verify now
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        {action.ownerId ? `${users.nameOf(action.ownerId)} · ` : null}
        {action.dueDate ? `due ${day(action.dueDate)} · ` : null}
        <Baseline action={action} />
        {action.claimedAvoidedLoss && (
          <>
            {' '}· claimed{' '}
            <Quantity value={action.claimedAvoidedLoss.amount} uom={action.claimedAvoidedLoss.currency} fractionDigits={currencyDigits(action.claimedAvoidedLoss.currency)} />
          </>
        )}
      </p>
      {action.postAction && (
        <p data-testid="realized">
          Realized: expected {action.postAction.realized.expected}, observed {action.postAction.realized.observed}, difference{' '}
          <strong>{action.postAction.realized.difference}</strong> ({labelOf(RCA_BASELINE_METRIC_LABELS, action.postAction.realized.metric).toLowerCase()})
        </p>
      )}
      {update.error || verify.error ? <FriendlyErrorAlert error={update.error ?? verify.error} /> : null}
    </li>
  );
}
