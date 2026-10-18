import type { RcaActionView } from '@/api/v2/types/rca';
import { useUserNames } from '@/features/ux-kit/labels';
import { useRcaFormat } from '../use-rca-format';

type CancelFacts = Pick<RcaActionView, 'status' | 'cancelReason' | 'cancelledBy' | 'cancelledAt'>;

/** F-9: why, by whom and when a cancelled action was cancelled (as recorded by the server). */
export function ActionCancelInfo({ action }: { action: CancelFacts }) {
  const users = useUserNames(action.cancelledBy ? [action.cancelledBy] : []);
  const { dateTime } = useRcaFormat();
  if (action.status !== 'cancelled') return null;
  const who = action.cancelledBy ? users.nameOf(action.cancelledBy) : null;
  const when = action.cancelledAt ? dateTime(action.cancelledAt) : null;
  return (
    <div className="rounded border border-dashed p-2 text-muted-foreground" data-testid="action-cancel-info">
      <p>
        <span className="font-medium text-foreground">Cancelled</span>
        {who ? ` by ${who}` : ''}
        {when ? ` at ${when}` : ''}
      </p>
      <p className="whitespace-pre-wrap">{action.cancelReason ? `Reason: ${action.cancelReason}` : 'No reason was recorded.'}</p>
    </div>
  );
}
