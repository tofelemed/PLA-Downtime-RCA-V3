import { Button } from '@/components/ui/button';
import type { RevisionSelector } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { EditorProblem } from '../editor/editor-problem';
import { useWorkflowActions, type WorkflowActions } from '../hooks/use-workflow-actions';
import { approveGate, reviewGate } from '../model/display';
import { allowsDirectRevision } from '../model/month-lock';
import { ApproveRevisionDialog } from './approve-revision-dialog';
import { ReasonConfirm } from './reason-confirm';
import { RecomputeState } from './recompute-state';
import { RejectDialog } from './reject-dialog';

export interface WorkflowBarProps {
  view: ReconciliationView;
  shown: RevisionSelector;
  onShowCurrent: () => void;
  /** the period workspace's shared commands (so the sticky bar shows the same recompute state); omitted = own */
  actions?: WorkflowActions;
}

/** a refused command keeps its dialog open (the problem is shown in it) */
const orKeepOpen = (done: Promise<boolean>) => done.then((ok) => (ok ? undefined : Promise.reject(new Error('refused'))));

function ReviewButtons({ view, actions, busy }: { view: ReconciliationView; actions: WorkflowActions; busy: boolean }) {
  const userId = useCurrentUserId();
  const { isSuperAdmin } = useCapabilities();
  const gate = reviewGate(view, userId, isSuperAdmin);
  const approve = approveGate(view, userId, isSuperAdmin);
  const access = approvalAccess(true, view.revision.submittedBy, userId, isSuperAdmin);
  return (
    <>
      <ApproveRevisionDialog view={view} access={access} disabled={busy || !approve.allowed} describedBy={approve.reason ? 'approve-gate' : undefined} onConfirm={(comment) => orKeepOpen(actions.approve(comment))}>
        {actions.problem && <EditorProblem problem={actions.problem} />}
      </ApproveRevisionDialog>
      <RejectDialog view={view} disabled={busy || !gate.allowed} onConfirm={(reason, failedLines) => orKeepOpen(actions.reject(reason, failedLines))}>
        {actions.problem && <EditorProblem problem={actions.problem} />}
      </RejectDialog>
    </>
  );
}

/**
 * Workflow of the shown revision: draft — recompute, submit, cancel; in review — approve / reject (not
 * the submitter: separation of duties) and recompute when stale; approved — reopen for revision (only while
 * the month allows a direct correction, UX D-7). Reasons
 * are required fields of the confirmation dialogs; the server decides and its refusals are shown.
 */
export function WorkflowBar(props: WorkflowBarProps) {
  return props.actions ? <WorkflowBarBody {...props} actions={props.actions} /> : <OwnWorkflowBar {...props} />;
}

function OwnWorkflowBar(props: WorkflowBarProps) {
  const actions = useWorkflowActions(props.view);
  return <WorkflowBarBody {...props} actions={actions} />;
}

function WorkflowBarBody({ view, shown, onShowCurrent, actions }: WorkflowBarProps & { actions: WorkflowActions }) {
  const { canWritePeriods: write, canApproveRevisions: decide, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const lifecycle = view.revision.lifecycle;
  const gate = approveGate(view, userId, isSuperAdmin);
  const busy = actions.pending !== null;
  return (
    <section id="period-review" className="scroll-mt-24 space-y-2 rounded-md border bg-muted/20 p-2" data-highlight-label="the period review" data-testid="workflow-bar" data-lifecycle={lifecycle}>
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
        {decide && lifecycle === 'approved' && allowsDirectRevision(view) && (
          <ReasonConfirm trigger="Reopen for revision…" triggerTestId="wf-revise" disabled={busy} title="Reopen this approved period?" description="A new draft revision is created for the engineer; the approved figures stay in force until the new revision is approved." confirmLabel="Reopen for revision" onConfirm={(reason) => orKeepOpen(actions.revise(reason)).then(onShowCurrent)}>
            {actions.problem && <EditorProblem problem={actions.problem} />}
          </ReasonConfirm>
        )}
        <RecomputeState state={actions.recomputeState} />
      </div>
      {decide && lifecycle === 'in_review' && gate.reason && (
        <p id="approve-gate" className="text-sm" data-testid="approve-gate" data-code={gate.code ?? ''}>
          {gate.reason}
        </p>
      )}
      {write && lifecycle === 'draft' && <p className="text-xs text-muted-foreground">Submitting checks codes, unaccounted quantity, tolerance and coverage on the server; unsaved line changes are not submitted.</p>}
      {actions.problem && <EditorProblem problem={actions.problem} />}
    </section>
  );
}
