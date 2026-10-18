import { useQueryClient } from '@tanstack/react-query';
import { useBridgeReview } from '@/api/v2/queries/period-workflow';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useUserNames } from '@/features/ux-kit/labels/use-user-names';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { periodRefOf, reconciliationKey } from '../hooks/use-draft-editor';
import { reviewGate } from '../model/display';

/**
 * SME R8: bridges of the submitted revision above the unit limit (absolute or relative to the plan, the
 * server's findings) and their second independent review — a revision approver who neither submitted nor
 * wrote the lines confirms them; someone else approves. Hidden when no bridge is above the limit.
 */
export function BridgeReviewPanel({ view }: { view: ReconciliationView }) {
  const { canApproveRevisions, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  const command = useBridgeReview();
  const { decimal } = useNumberFormat();
  const bridge = view.bridgeReview;
  const users = useUserNames(bridge?.review?.by ? [bridge.review.by] : []);
  if (!bridge?.required || view.revision.lifecycle !== 'in_review') return null;
  const independent = reviewGate(view, userId, isSuperAdmin).allowed && (isSuperAdmin || !view.lines.some((l) => l.authorId === userId));
  const review = () =>
    command
      .submit({ period: periodRefOf(view), revision: view.revision.revision, submittedHash: view.revision.submittedHash ?? '' })
      .then((next) => queryClient.setQueryData(reconciliationKey(tenantId, view.periodId), next))
      .catch(() => undefined);
  return (
    <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="bridge-review" data-reviewed={Boolean(bridge.review)}>
      <p className="font-medium">Bridge above the unit limit</p>
      <ul className="list-disc pl-5">
        {bridge.findings.map((f) => (
          <li key={f.ref}>
            {decimal(f.quantity)} — limit {decimal(f.limit)} ({f.basis === 'absolute' ? 'absolute' : 'share of the plan'})
          </li>
        ))}
      </ul>
      {bridge.justification?.found && (
        <p data-testid="bridge-justification">
          Limit justified by the unit’s uncertainty budget: expanded uncertainty {decimal(bridge.justification.expandedUncertainty)} {bridge.justification.uom ?? ''}
          {bridge.justification.reviewOverdue ? ' (budget review overdue)' : ''}
        </p>
      )}
      {bridge.review ? (
        <p data-testid="bridge-reviewed">Reviewed by {users.nameOf(bridge.review.by ?? '')}; {isSuperAdmin ? 'you may also approve the period as SuperAdmin.' : 'another approver approves the period.'}</p>
      ) : (
        <p>{isSuperAdmin ? 'Confirm the bridge review, then approve the period as SuperAdmin.' : 'A second independent reviewer confirms the bridge before the period can be approved.'}</p>
      )}
      {canApproveRevisions && !bridge.review && independent && (
        <Button size="sm" variant="outline" data-testid="bridge-review-confirm" disabled={command.isPending} onClick={() => void review()}>
          Confirm the bridge as second reviewer
        </Button>
      )}
      {command.error ? <FriendlyErrorAlert error={command.error} /> : null}
    </section>
  );
}
