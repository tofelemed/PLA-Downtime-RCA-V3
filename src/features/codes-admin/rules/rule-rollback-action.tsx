import { useState } from 'react';
import { useRollbackRule } from '@/api/v2/queries/rules';
import type { RuleView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useCodesSaveFeedback } from '../hooks/use-codes-save-feedback';

/**
 * "Roll back to this version" after a confirmation: the server adds a new version with that definition.
 * Success is a toast; a refusal is the red alert inside the dialog.
 */
export function RuleRollbackAction({ rule, version }: { rule: RuleView; version: number }) {
  const rollback = useRollbackRule();
  const feedback = useCodesSaveFeedback();
  const [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) feedback.clearFailure();
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="rule-rollback">
        Roll back to this version…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Restore version ${version}?`}
        description="Its definition becomes a new version in force from now on. The current version stays in the history."
        confirmLabel="Restore version"
        onConfirm={() => feedback.run(() => rollback.submit({ rule, toVersion: version }), `Version ${version} restored as the version in force`)}
      >
        {feedback.alert}
      </ConfirmDialog>
    </>
  );
}
