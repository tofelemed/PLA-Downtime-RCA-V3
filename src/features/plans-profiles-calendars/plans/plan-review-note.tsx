import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { useUserNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusIcon } from '@/lib/icons';

export interface PlanReviewNoteProps {
  plan: PlanView;
  version: PlanVersionView;
  timezone: string;
}

/** Where the open version stands in review: submitted (waiting for an approver) or returned with a reason. */
export function PlanReviewNote({ plan, version, timezone }: PlanReviewNoteProps) {
  const users = useUserNames();
  const review = plan.review;
  if (!review) return null;
  if (version.approvalState === 'submitted' && review.submittedAt) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="plan-submitted" role="status">
        Submitted for approval by {users.nameOf(review.submittedBy)} on <PlantTime iso={review.submittedAt} tz={timezone} withDate />.
      </p>
    );
  }
  // a return recorded before this version existed belongs to an earlier version
  const forThisVersion = review.returnedAt !== null && review.returnedAt >= version.createdAt;
  if (version.approvalState !== 'draft' || !review.returnReason || !forThisVersion) return null;
  const Icon = StatusIcon.warning;
  return (
    <Alert data-testid="plan-returned">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Returned by {users.nameOf(review.returnedBy)}</AlertTitle>
      <AlertDescription>
        {review.returnedAt && (
          <>
            <PlantTime iso={review.returnedAt} tz={timezone} withDate />:{' '}
          </>
        )}
        {review.returnReason}
      </AlertDescription>
    </Alert>
  );
}
