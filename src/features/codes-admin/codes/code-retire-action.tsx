import { useState } from 'react';
import { useCodeReferences, useRetireCode } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';

export interface CodeRetireActionProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
}

/** What still points at the code, from the server (loaded when the confirmation opens). */
function RetireImpact({ library, code }: CodeRetireActionProps) {
  const references = useCodeReferences(library, code.id);
  const counts = references.data;
  return (
    <DataState state={dataStateOf(references)} error={references.error}>
      {counts && (
        <ul className="space-y-1 text-sm" data-testid="retire-impact">
          <li data-testid="impact-children" data-count={counts.activeChildren}>
            Active sub-codes: <strong>{counts.activeChildren}</strong>
            {counts.activeChildren > 0 && ' — retire or move them first'}
          </li>
          <li data-testid="impact-events" data-count={counts.events}>
            Events coded with it: <strong>{counts.events}</strong> (they keep their coding)
          </li>
          <li data-testid="impact-rules" data-count={counts.mappingRules}>
            Default mapping versions naming it: <strong>{counts.mappingRules}</strong>
          </li>
        </ul>
      )}
    </DataState>
  );
}

/**
 * Retire with impact (plan 3.8, T18): a confirmation that lists what still points at the code; a code
 * with active sub-codes is refused (409 CODE_HAS_CHILDREN) and the dialog stays open with the reason.
 * History and past codings stay.
 */
export function CodeRetireAction({ library, code }: CodeRetireActionProps) {
  const [open, setOpen] = useState(false);
  const retire = useRetireCode(library);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) retire.reset();
  };
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} data-testid="code-retire">
        Retire…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Retire ${code.code}?`}
        description="Retiring ends the code's validity now. Its versions, past events and mapping history are kept."
        confirmLabel="Retire code"
        destructive
        onConfirm={() => retire.submit({ id: code.id })}
      >
        {open && <RetireImpact library={library} code={code} />}
        {retire.error ? <AdminRefusalAlert error={retire.error} /> : null}
      </ConfirmDialog>
    </>
  );
}
