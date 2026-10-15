import { Button } from '@/components/ui/button';
import type { RevisionSelector } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { EditorProblem } from '../editor/editor-problem';
import { useWorkflowActions } from '../hooks/use-workflow-actions';
import { approveGate, reviewGate } from '../model/display';
import { ReasonConfirm } from './reason-confirm';

export interface WorkflowBarProps {
  view: ReconciliationView;
  shown: RevisionSelector;
  onShowCurrent: () => void;
}

const RECOMPUTE_LABELS: Record<string, string> = { queued: 'Recompute queued…', running: 'Recomputing…', completed: 'Recompute finished', failed: 'Recompute failed — try again' };

/** a refused command keeps its dialog open (the problem is shown in it) */
const orKeepOpen = (done: Promise<boolean>) => done.then((ok) => (ok ? undefined : Promise.reject(new Error('refused'))));

type Actions = ReturnType<typeof useWorkflowActions>;

function ReviewButtons({ view, actions, busy }: { view: ReconciliationView; actions: Actions; busy: boolean }) {
  const userId = useCurrentUserId();
  const gate = reviewGate(view, userId);
  const approve = approveGate(view, userId);
  const access = approvalAccess(true, view.revision.submittedBy, userId);
  return (
    <>
      <ApproveButton access={access} size="sm" data-testid="wf-approve" disabled={busy || !approve.allowed} onClick={() => void actions.approve()} aria-describedby={approve.reason ? 'approve-gate' : undefined}>
        Approve
      </ApproveButton>
      <ReasonConfirm
        trigger="Reject…"
        triggerTestId="wf-reject"
        disabled={busy || !gate.allowed}
        title="Return this revision to its author?"
        description="The revision goes back to draft; the author sees your reason, fixes the lines and submits again."
        confirmLabel="Return revision"
        destructive
        onConfirm={(reason) => orKeepOpen(actions.reject(reason))}
      >
        {actions.problem && <EditorProblem problem={actions.problem} />}
      </ReasonConfirm>
    </>
  );
}

/**
 * Workflow of the shown revision: draft — recompute, submit, cancel; in review — approve / reject (not
 * the submitter: separation of duties) and recompute when stale; approved — reopen for revision. Reasons
 * are required fields of the confirmation dialogs; the server decides and its refusals are shown.
 */
export function WorkflowBar({ view, shown, onShowCurrent }: WorkflowBarProps) {
  const { canWritePeriods: write, canApproveRevisions: decide } = useCapabilities();
  const userId = useCurrentUserId();
  const actions = useWorkflowActions(view);
  const lifecycle = view.revision.lifecycle;
  const gate = approveGate(view, userId);
  const busy = actions.pending !== null;
  return (
    <section className="space-y-2 rounded-md border bg-muted/20 p-2" data-testid="workflow-bar" data-lifecycle={lifecycle}>
      <div className="flex flex-wrap items-center gap-2">
        <ReadOnlyHint />
        {write && lifecycle !== 'approved' && shown === 'current' && (
          <Button variant="outline" size="sm" data-testid="wf-recompute" disabled={busy} onClick={() => void actions.recompute()}>
            Recompute
          </Button>
        )}
        {write && lifecycle === 'draft' && (
          <Button size="sm" data-testid="wf-submit" disabled={busy || !view.baseRunId} onClick={() => void actions.submit()}>
            Submit for approval
          </Button>
        )}
        {decide && lifecycle === 'in_review' && <ReviewButtons view={view} actions={actions} busy={busy} />}
        {write && lifecycle === 'draft' && (
          <ReasonConfirm trigger="Cancel draft…" triggerTestId="wf-cancel" triggerVariant="ghost" disabled={busy} title="Cancel this draft revision?" description="Its lines are discarded; the period goes back to its last approved figures (or to not reconciled)." confirmLabel="Cancel draft" destructive onConfirm={(reason) => orKeepOpen(actions.cancel(reason))}>
            {actions.problem && <EditorProblem problem={actions.problem} />}
          </ReasonConfirm>
        )}
        {decide && lifecycle === 'approved' && (
          <ReasonConfirm trigger="Unlock (revise)…" triggerTestId="wf-revise" disabled={busy} title="Reopen this approved period?" description="A new draft revision is created for the engineer; the approved figures stay in force until the new revision is approved." confirmLabel="Reopen for revision" onConfirm={(reason) => orKeepOpen(actions.revise(reason)).then(onShowCurrent)}>
            {actions.problem && <EditorProblem problem={actions.problem} />}
          </ReasonConfirm>
        )}
        {actions.recomputeState && (
          <span className="text-xs" role="status" data-testid="recompute-state" data-state={actions.recomputeState}>
            {RECOMPUTE_LABELS[actions.recomputeState] ?? 'Recomputing…'}
          </span>
        )}
      </div>
      {decide && lifecycle === 'in_review' && gate.reason && (
        <p id="approve-gate" className="text-sm" data-testid="approve-gate" data-code={gate.code ?? ''}>
          {gate.reason}
        </p>
      )}
      {write && lifecycle === 'draft' && <p className="text-xs text-muted-foreground">Submitting checks codes, residual, tolerance and coverage on the server; unsaved line changes are not submitted.</p>}
      {actions.problem && <EditorProblem problem={actions.problem} />}
    </section>
  );
}
