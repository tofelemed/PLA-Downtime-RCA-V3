import type { RcaCaseView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useCasePatch } from '../use-case-patch';

export interface CloseCaseButtonProps {
  /** the closed case as the server answered it */
  onClosed: (rca: RcaCaseView) => void;
  disabled?: boolean;
}

/**
 * "Close case": the status transition to Closed (`PATCH /v2/rcas/:id` with If-Match). The server writes
 * the unpublished knowledge-base entry and completes the linked events; a refusal shows on the page.
 */
export function CloseCaseButton({ onClosed, disabled }: CloseCaseButtonProps) {
  const patch = useCasePatch();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" disabled={disabled || patch.isPending} data-testid="close-case">
          Close case
        </Button>
      }
      title="Close this case?"
      description="Closing writes an unpublished knowledge-base entry and marks the linked events as completed. The case can still be reopened by changing its status."
      confirmLabel="Close case"
      onConfirm={() => patch.save({ status: 'Closed' }).then(onClosed)}
    >
      {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
    </ConfirmDialog>
  );
}
