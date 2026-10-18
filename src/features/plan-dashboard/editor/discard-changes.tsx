import { Button } from '@/components/ui/button';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { countDraftChanges } from '../model/draft-changes';
import type { DraftState } from '../model/draft-lines';

export interface DiscardChangesProps {
  view: ReconciliationView;
  draft: DraftState;
  disabled: boolean;
  onDiscard: () => void;
}

/** "Discard changes" behind a confirmation that says how many unsaved edits are lost. */
export function DiscardChanges({ view, draft, disabled, onDiscard }: DiscardChangesProps) {
  const { number } = useNumberFormat();
  const count = countDraftChanges(draft, view);
  const description =
    count > 0
      ? `${number(count)} unsaved ${count === 1 ? 'change' : 'changes'} will be lost. The loss lines go back to the last saved state.`
      : 'Your unsaved edits will be lost. The loss lines go back to the last saved state.';
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" data-testid="discard-lines" disabled={disabled}>
          Discard changes
        </Button>
      }
      title="Discard unsaved loss-line changes?"
      description={description}
      confirmLabel="Discard changes"
      destructive
      onConfirm={onDiscard}
    />
  );
}
