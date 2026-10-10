import { useCodeReferences, useRetireCode } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';

export interface RetireDialogProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
  onClose: () => void;
}

/**
 * Retire with impact (plan 3.8, T18): the server's reference counts first; a code with active children
 * cannot be retired (409 CODE_HAS_CHILDREN with the same counts). History and past codings stay.
 */
export function RetireDialog({ library, code, onClose }: RetireDialogProps) {
  const references = useCodeReferences(library, code.id);
  const retire = useRetireCode(library);
  const counts = references.data;
  const confirm = async () => {
    const done = await retire.submit({ id: code.id }).catch(() => null);
    if (done) onClose();
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="retire-dialog">
        <DialogHeader>
          <DialogTitle>
            Retire <span className="font-mono">{code.code}</span>?
          </DialogTitle>
          <DialogDescription>Retiring ends the code's validity now. Its versions, past events and mapping history are kept.</DialogDescription>
        </DialogHeader>
        <DataState state={dataStateOf(references)} error={references.error}>
          {counts && (
            <ul className="space-y-1 text-sm" data-testid="retire-impact">
              <li data-testid="impact-children" data-count={counts.activeChildren}>
                Active child codes: <strong>{counts.activeChildren}</strong>
                {counts.activeChildren > 0 && ' — retire or move them first'}
              </li>
              <li data-testid="impact-events" data-count={counts.events}>
                Events coded with it: <strong>{counts.events}</strong> (they keep their coding)
              </li>
              <li data-testid="impact-rules" data-count={counts.mappingRules}>
                Mapping rule versions naming it: <strong>{counts.mappingRules}</strong>
              </li>
            </ul>
          )}
        </DataState>
        {retire.error ? <AdminRefusalAlert error={retire.error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={retire.isPending || !counts} data-testid="retire-confirm">
            Retire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
