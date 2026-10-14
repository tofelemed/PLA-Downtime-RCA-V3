import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { WorkflowProblem } from '../model/workflow-errors';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ConflictDialogsProps {
  /** a 409 RUN_CHANGED or 412 STALE_REVISION of the last save, else null */
  problem: WorkflowProblem | null;
  onRebase: () => void;
  onClose: () => void;
}


/**
 * Save conflicts (§15.3): RUN_CHANGED shows the candidate diff of the new run (added / removed / changed
 * with before → after from the server); 412 says another user saved first. Rebase reloads the latest
 * revision and keeps the user's lines on top of it; nothing was applied by the refused save.
 */
export function ConflictDialogs({ problem, onRebase, onClose }: ConflictDialogsProps) {
  const { number } = useNumberFormat();
  const runChanged = problem?.kind === 'run_changed';
  const diff = problem?.diff;
  return (
    <Dialog open={problem !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="conflict-dialog" data-code={problem?.code}>
        <DialogHeader>
          <DialogTitle>{runChanged ? 'The calculation was rerun' : 'Someone else saved this revision'}</DialogTitle>
          <DialogDescription>Your save was not applied. Rebase to load the latest revision and keep your lines, then save again.</DialogDescription>
        </DialogHeader>
        {runChanged && diff && (
          <div className="space-y-1 text-sm" data-testid="candidate-diff">
            <p>A newer calculation exists for this period.</p>
            {diff.added.length > 0 && <p>{number(diff.added.length)} new automatic candidate(s).</p>}
            {diff.removed.length > 0 && <p>{number(diff.removed.length)} automatic candidate(s) no longer found.</p>}
            {diff.changed.map((c, index) => (
              <p key={c.autoKey}>
                Candidate {number(index + 1)} changed: {c.before} → {c.after}
              </p>
            ))}
            {!diff.added.length && !diff.removed.length && !diff.changed.length && <p>The candidates are unchanged; only the run is new.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button data-testid="rebase" onClick={onRebase}>
            Rebase on the latest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
