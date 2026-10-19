import { useDismissRcaRecommendation } from '@/api/v2/queries/rca-commands';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { ReasonConfirm } from '@/features/plan-dashboard/workflow/reason-confirm';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { recommendationText } from '../model/rca-labels';

/** "Dismiss" of an open RCA recommendation: a required reason, recorded by the server with the dismissal. */
export function DismissRecommendation({ recommendation }: { recommendation: RcaRecommendationView }) {
  const dismiss = useDismissRcaRecommendation();
  return (
    <ReasonConfirm
      trigger="Dismiss"
      triggerTestId="dismiss-recommendation"
      triggerVariant="ghost"
      disabled={dismiss.isPending}
      title="Dismiss this recommendation?"
      description={`Investigation recommended: ${recommendationText(recommendation)}. Say why no investigation is needed; the reason is kept with the recommendation.`}
      confirmLabel="Dismiss recommendation"
      onConfirm={(reason) => dismiss.submit({ id: recommendation.id, reason })}
    >
      {dismiss.error ? <FriendlyErrorAlert error={dismiss.error} /> : null}
    </ReasonConfirm>
  );
}
