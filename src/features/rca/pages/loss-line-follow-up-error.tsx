import { Link } from 'react-router-dom';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';

/** The loss line of `/rca/new?lossLineId=` could not be linked: the error and a way into the saved case. */
export function LossLineFollowUpError({ error, caseId }: { error: unknown; caseId: string | null }) {
  if (!caseId) return null;
  return (
    <div className="space-y-2" data-testid="loss-line-link-failed">
      <FriendlyErrorAlert error={error} />
      <p className="text-sm">
        The investigation was saved, but the loss line could not be linked.{' '}
        <Link className="underline" to={`/rca/${encodeURIComponent(caseId)}`}>
          Open the investigation
        </Link>{' '}
        and link it from Links.
      </p>
    </div>
  );
}
