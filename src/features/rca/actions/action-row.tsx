import { useUpdateRcaAction, useVerifyRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currencyDigits } from '@/features/display-currency/money-format';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { CommandError } from '@/features/event-hub/components/command-error';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { verificationLabel } from '../model/rca-labels';

const STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;

/** One action: status, due, verification state and — once verified — the realized difference. */
export function ActionRow({ action, timezone }: { action: RcaActionView; timezone: string }) {
  const { canWriteRca } = useCapabilities();
  const update = useUpdateRcaAction();
  const verify = useVerifyRcaAction();
  const setStatus = (status: (typeof STATUSES)[number]) => void update.submit({ action, body: { status } }).catch(() => null);
  return (
    <li className="space-y-1 p-2 text-sm" data-testid="action-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{action.title}</span>
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            aria-label={`Status of ${action.title}`}
            value={action.status}
            disabled={!canWriteRca}
            onChange={(e) => setStatus(STATUSES.find((s) => s === e.target.value) ?? 'open')}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
          <Badge variant="outline" data-testid="verification-status">{verificationLabel(action.verificationStatus)}</Badge>
          {action.verificationStatus === 'due' && canWriteRca && (
            <Button size="sm" disabled={verify.isPending} onClick={() => void verify.submit(action).catch(() => null)} data-testid="verify-action">
              Verify now
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        {action.dueDate ? <>due <PlantTime iso={action.dueDate} tz={timezone} withDate /> · </> : null}
        {action.baseline
          ? `baseline ${action.baseline.value} ${action.baseline.metric.replace('_', ' ')} / ${action.baseline.windowDays} d (${action.baseline.declared ? 'declared' : 'counted'})`
          : 'no baseline'}
        {action.claimedAvoidedLoss && (
          <> · claimed <Quantity value={action.claimedAvoidedLoss.amount} uom={action.claimedAvoidedLoss.currency} fractionDigits={currencyDigits(action.claimedAvoidedLoss.currency)} /></>
        )}
      </p>
      {action.postAction && (
        <p data-testid="realized">
          Realized: expected {action.postAction.realized.expected}, observed {action.postAction.realized.observed}, difference{' '}
          <strong>{action.postAction.realized.difference}</strong> ({action.postAction.realized.metric.replace('_', ' ')})
        </p>
      )}
      <CommandError error={update.error ?? verify.error} />
    </li>
  );
}
