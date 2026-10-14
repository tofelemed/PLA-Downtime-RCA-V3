import { useUpdateRcaAction, useVerifyRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currencyDigits } from '@/features/display-currency/money-format';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_STATUS_LABELS, RCA_ACTION_TYPE_LABELS, RCA_BASELINE_METRIC_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { Quantity } from '@/features/ux-kit/quantity';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { verificationLabel } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { ActionBaseline } from './action-baseline';
import { ActionCompletion } from './action-completion';
import { ActionVerdict } from './action-verdict';

const STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;

function StatusControls({ action }: { action: RcaActionView }) {
  const { canWriteRca } = useCapabilities();
  const update = useUpdateRcaAction();
  const verify = useVerifyRcaAction();
  const setStatus = (status: (typeof STATUSES)[number]) => void update.submit({ action, body: { status } }).catch(() => null);
  return (
    <div className="space-y-1">
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
      {update.error || verify.error ? <RcaErrorAlert error={update.error ?? verify.error} /> : null}
    </div>
  );
}

function Meta({ action }: { action: RcaActionView }) {
  const users = useUserNames();
  const { day } = useRcaFormat();
  const claim = action.claimedAvoidedLoss;
  return (
    <p className="text-muted-foreground">
      {action.actionType ? `${labelOf(RCA_ACTION_TYPE_LABELS, action.actionType)} · ` : 'Type not chosen · '}
      {action.ownerId ? `owner ${users.nameOf(action.ownerId)} · ` : null}
      {action.dueDate ? `due ${day(action.dueDate)}` : 'no due date'}
      {claim && (
        <>
          {' '}· claimed <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} />
        </>
      )}
    </p>
  );
}

/** One action: type, owner, status, completion evidence, baseline, verification and the server's verdict. */
export function ActionRow({ action }: { action: RcaActionView }) {
  const { canWriteRca } = useCapabilities();
  const realized = action.postAction?.realized;
  return (
    <li className="space-y-2 p-2 text-sm" data-testid="action-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{action.title}</span>
        <StatusControls action={action} />
      </div>
      <Meta action={action} />
      <ActionCompletion key={action.rowVersion} action={action} canWrite={canWriteRca} />
      <ActionBaseline action={action} />
      <ActionVerdict action={action} />
      {realized && (
        <p data-testid="realized">
          Realized: expected {formatDecimal(realized.expected, 2)}, observed {formatDecimal(realized.observed, 2)}, difference{' '}
          <strong>{formatDecimal(realized.difference, 2)}</strong> (
          {labelOf(RCA_BASELINE_METRIC_LABELS, realized.metric).toLowerCase()})
        </p>
      )}
    </li>
  );
}
