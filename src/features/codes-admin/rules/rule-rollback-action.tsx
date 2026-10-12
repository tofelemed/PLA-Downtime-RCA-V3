import { useState } from 'react';
import { useRollbackRule } from '@/api/v2/queries/rules';
import type { RuleView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';

/** "Roll back to this version" after a confirmation: the server adds a new version with that definition. */
export function RuleRollbackAction({ rule, version }: { rule: RuleView; version: number }) {
  const rollback = useRollbackRule();
  const [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) rollback.reset();
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
        onConfirm={() => rollback.submit({ rule, toVersion: version })}
      >
        {rollback.error ? <AdminRefusalAlert error={rollback.error} /> : null}
      </ConfirmDialog>
    </>
  );
}
