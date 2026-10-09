import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { WorkflowProblem } from '../model/workflow-errors';

export interface ConflictDialogsProps {
  /** a 409 RUN_CHANGED or 412 STALE_REVISION of the last save, else null */
  problem: WorkflowProblem | null;
  onRebase: () => void;
  onClose: () => void;
}

const short = (key: string) => (key.length > 24 ? `${key.slice(0, 24)}…` : key);

/**
 * Save conflicts (§15.3): RUN_CHANGED shows the candidate diff of the new run (added / removed / changed
 * with before → after from the server); 412 says another user saved first. Rebase reloads the latest
 * revision and keeps the user's lines on top of it; nothing was applied by the refused save.
 */
export function ConflictDialogs({ problem, onRebase, onClose }: ConflictDialogsProps) {
  const runChanged = problem?.kind === 'run_changed';
  const diff = problem?.diff;
  return (
    <Dialog open={problem !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="conflict-dialog" data-code={problem?.code}>
        <DialogHeader>
          <DialogTitle>{runChanged ? 'The calculation run changed (RUN_CHANGED)' : 'Someone else saved this revision (STALE_REVISION)'}</DialogTitle>
          <DialogDescription>Your save was not applied. Rebase to load the latest revision and keep your lines, then save again.</DialogDescription>
        </DialogHeader>
        {runChanged && diff && (
          <div className="space-y-1 text-sm" data-testid="candidate-diff">
            <p>New run: {diff.currentRunId ? diff.currentRunId.slice(0, 8) : '—'}</p>
            {diff.added.length > 0 && <p>Added candidates: {diff.added.map(short).join(', ')}</p>}
            {diff.removed.length > 0 && <p>Removed candidates: {diff.removed.map(short).join(', ')}</p>}
            {diff.changed.map((c) => (
              <p key={c.autoKey}>
                Changed {short(c.autoKey)}: {c.before} → {c.after}
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
