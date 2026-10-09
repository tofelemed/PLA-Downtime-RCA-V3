import { Button } from '@/components/ui/button';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { useDraftEditor } from '../hooks/use-draft-editor';
import { issuesByRow } from '../model/workflow-errors';
import { CandidateTable } from './candidate-table';
import { ConflictDialogs } from './conflict-dialogs';
import { EditorProblem } from './editor-problem';
import { ManualLines } from './manual-lines';

export interface LossLineEditorProps {
  view: ReconciliationView;
  timezone: string;
  /** in review, approved or the approved view: the lines are shown, not edited */
  readOnly?: boolean;
}

/**
 * Loss-line editor (plan 3.5 step 2, replaces the v1 reconcile modal): automatic candidates with
 * provenance and accept / adjust / replace / reject, manual lines with event evidence or an explicit
 * "no event" / "missing code", and one atomic save of the full set. Figures and budgets are the
 * server's; refusals are shown on the line they concern.
 */
export function LossLineEditor({ view, timezone, readOnly = false }: LossLineEditorProps) {
  const editor = useDraftEditor(view);
  const rowIssues = issuesByRow(editor.problem?.issues ?? [], editor.refs);
  const conflict = editor.problem?.kind === 'run_changed' || editor.problem?.kind === 'stale_revision' ? editor.problem : null;
  return (
    <section className="space-y-3" data-testid="loss-line-editor" data-dirty={editor.draft.dirty} aria-label="Loss lines">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Loss lines (plan ledger)</h3>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={editor.discard} disabled={!editor.draft.dirty || editor.saving}>
              Discard changes
            </Button>
            <Button size="sm" data-testid="save-lines" onClick={() => void editor.save()} disabled={!editor.draft.dirty || editor.saving || !view.baseRunId}>
              {editor.saving ? 'Saving…' : 'Save lines'}
            </Button>
          </div>
        )}
      </div>
      {editor.draft.dirty && !readOnly && <p className="text-xs text-amber-700">Unsaved changes — the figures above are the last saved state; the server recomputes them on save.</p>}
      {editor.dropped && editor.dropped.length > 0 && (
        <p className="text-xs text-amber-700" data-testid="rebase-dropped">
          Rebased on the new run: {editor.dropped.length} decision(s) dropped because their candidate no longer exists.
        </p>
      )}
      <CandidateTable view={view} draft={editor.draft} setDraft={editor.setDraft} issues={rowIssues} readOnly={readOnly} />
      <ManualLines view={view} draft={editor.draft} setDraft={editor.setDraft} issues={rowIssues} readOnly={readOnly} timezone={timezone} />
      {view.lines.some((l) => l.action === 'tolerance') && (
        <p className="text-xs" data-testid="tolerance-line">
          Tolerance adjustment line(s) written on submission:{' '}
          {view.lines
            .filter((l) => l.action === 'tolerance')
            .map((l) => `${l.quantity ?? '—'} ${l.uom ?? ''}`)
            .join(', ')}
        </p>
      )}
      {editor.problem && !conflict && <EditorProblem problem={editor.problem} />}
      <ConflictDialogs problem={conflict} onRebase={() => void editor.rebase()} onClose={editor.dismissProblem} />
    </section>
  );
}
