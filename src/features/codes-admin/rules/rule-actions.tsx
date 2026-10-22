import { useState } from 'react';
import { useActivateRule, useRetireRule } from '@/api/v2/queries/rules';
import type { RuleView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useCodesSaveFeedback } from '../hooks/use-codes-save-feedback';

/**
 * One confirmation and its feedback: success is a toast, a refusal the red alert inside the dialog (which
 * stays open); closing it clears the last refusal.
 */
function useConfirm() {
  const [open, setOpen] = useState(false);
  const feedback = useCodesSaveFeedback();
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) feedback.clearFailure();
  };
  return { open, setOpen, onOpenChange, run: feedback.run, alert: feedback.alert };
}

/**
 * Activate the waiting draft and retire the rule, each after a confirmation. Activation is a second
 * person's act (403 SEPARATION_OF_DUTIES for the draft author): the author sees it disabled with the
 * reason; roles that can never approve do not see either action.
 */
export function RuleActions({ rule, currentUserId }: { rule: RuleView; currentUserId: string | null }) {
  const { canApproveRules, isSuperAdmin } = useCapabilities();
  const activate = useActivateRule();
  const retire = useRetireRule();
  const activation = useConfirm();
  const retirement = useConfirm();
  if (rule.state === 'retired') return null;
  const access = approvalAccess(canApproveRules, rule.draft?.authorId, currentUserId, isSuperAdmin);
  return (
    <>
      {rule.draft && (
        <ApproveButton access={access} onClick={() => activation.setOpen(true)} data-testid="rule-activate">
          Activate draft…
        </ApproveButton>
      )}
      {canApproveRules && (
        <Button variant="destructive" onClick={() => retirement.setOpen(true)} data-testid="rule-retire">
          Retire…
        </Button>
      )}
      <ConfirmDialog
        open={activation.open}
        onOpenChange={activation.onOpenChange}
        title={`Activate the draft of “${rule.name}”?`}
        description="The draft becomes the version in force for new events from now on. Earlier versions stay and can be restored."
        confirmLabel="Activate rule"
        onConfirm={() => activation.run(() => activate.submit({ rule }), `“${rule.name}” activated`)}
      >
        {activation.alert}
      </ConfirmDialog>
      <ConfirmDialog
        open={retirement.open}
        onOpenChange={retirement.onOpenChange}
        title={`Retire “${rule.name}”?`}
        description="The rule stops applying to new events. Its versions are kept; a retired rule cannot be activated again."
        confirmLabel="Retire rule"
        destructive
        onConfirm={() => retirement.run(() => retire.submit({ rule }), `“${rule.name}” retired`)}
      >
        {retirement.alert}
      </ConfirmDialog>
    </>
  );
}
