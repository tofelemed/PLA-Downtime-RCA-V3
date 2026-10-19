import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';

export interface CreateVersionConfirmProps {
  plan: Pick<PlanView, 'name'>;
  version: Pick<PlanVersionView, 'version'>;
  pending: boolean;
  /** shows the form's errors; true when the version may be created */
  validate: () => boolean;
  onConfirm: () => Promise<void>;
}

/**
 * "Create version" of an approved plan (QA P-3): the form is checked first (the change reason is
 * required), then the user confirms that a new draft version opens while the approved one stays in force.
 */
export function CreateVersionConfirm({ plan, version, pending, validate, onConfirm }: CreateVersionConfirmProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(validate())} disabled={pending} data-testid="plan-save">
        Create version
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Create version ${version.version + 1} of ${plan.name}?`}
        description={`Version ${version.version} stays approved and in force until the new version is approved. The new version is saved as a draft.`}
        confirmLabel="Create version"
        busy={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}
