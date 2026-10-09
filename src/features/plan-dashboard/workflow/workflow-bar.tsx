import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import type { RevisionSelector } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { EditorProblem } from '../editor/editor-problem';
import { useWorkflowActions } from '../hooks/use-workflow-actions';
import { reviewGate } from '../model/display';

export interface WorkflowBarProps {
  view: ReconciliationView;
  shown: RevisionSelector;
  onShowCurrent: () => void;
}

const RECOMPUTE_LABELS: Record<string, string> = { queued: 'Recompute queued…', running: 'Recomputing…', completed: 'Recompute finished', failed: 'Recompute failed' };

/**
 * Workflow bar (plan 3.5 step 3): the actions of the shown revision's lifecycle — draft: recompute, submit,
 * cancel; in review: approve / reject (not for the submitter: separation of duties, D06) and recompute
 * when stale; approved: revise ("Unlock", WF04). The server decides and its refusals are shown as given.
 */
export function WorkflowBar({ view, shown, onShowCurrent }: WorkflowBarProps) {
  const { session } = useAuth();
  const actions = useWorkflowActions(view);
  const [reason, setReason] = useState('');
  const lifecycle = view.revision.lifecycle;
  const gate = reviewGate(view, session?.user?.id ?? null);
  const busy = actions.pending !== null;
  const needReason = (go: (r: string) => Promise<void>) => () => reason.trim() && void go(reason.trim()).then(() => setReason(''));
  return (
    <section className="space-y-2 rounded-md border bg-muted/20 p-2" data-testid="workflow-bar" data-lifecycle={lifecycle}>
      <div className="flex flex-wrap items-center gap-2">
        {lifecycle !== 'approved' && shown === 'current' && (
          <Button variant="outline" size="sm" data-testid="wf-recompute" disabled={busy} onClick={() => void actions.recompute()}>
            Recompute
          </Button>
        )}
        {lifecycle === 'draft' && (
          <Button size="sm" data-testid="wf-submit" disabled={busy || !view.baseRunId} onClick={() => void actions.submit()}>
            Submit for approval
          </Button>
        )}
        {lifecycle === 'in_review' && (
          <>
            <Button size="sm" data-testid="wf-approve" disabled={busy || !gate.allowed} onClick={() => void actions.approve()} aria-describedby={gate.reason ? 'approve-gate' : undefined}>
              Approve
            </Button>
            <Button variant="outline" size="sm" data-testid="wf-reject" disabled={busy || !gate.allowed || !reason.trim()} onClick={needReason(actions.reject)}>
              Reject
            </Button>
          </>
        )}
        {lifecycle === 'draft' && (
          <Button variant="ghost" size="sm" data-testid="wf-cancel" disabled={busy || !reason.trim()} onClick={needReason(actions.cancel)}>
            Cancel draft
          </Button>
        )}
        {lifecycle === 'approved' && (
          <Button variant="outline" size="sm" data-testid="wf-revise" disabled={busy || !reason.trim()} onClick={() => reason.trim() && void actions.revise(reason.trim()).then(onShowCurrent)}>
            Unlock (revise)
          </Button>
        )}
        {(lifecycle === 'in_review' || lifecycle === 'draft' || lifecycle === 'approved') && (
          <Input className="h-8 max-w-xs" aria-label="Reason" data-testid="wf-reason" placeholder={lifecycle === 'approved' ? 'Reason for the revision' : 'Reason (reject / cancel)'} value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        {actions.recomputeState && <span className="text-xs" data-testid="recompute-state" data-state={actions.recomputeState}>{RECOMPUTE_LABELS[actions.recomputeState] ?? actions.recomputeState}{actions.recomputeError ? `: ${actions.recomputeError}` : ''}</span>}
      </div>
      {lifecycle === 'in_review' && gate.reason && (
        <p id="approve-gate" className="text-sm" data-testid="approve-gate" data-code={gate.code ?? ''}>
          {gate.reason} {gate.code ? `(${gate.code})` : ''}
        </p>
      )}
      {lifecycle === 'draft' && <p className="text-xs text-muted-foreground">Submission checks codes, residual, tolerance and coverage on the server; unsaved line changes are not submitted.</p>}
      {actions.problem && <EditorProblem problem={actions.problem} />}
    </section>
  );
}
