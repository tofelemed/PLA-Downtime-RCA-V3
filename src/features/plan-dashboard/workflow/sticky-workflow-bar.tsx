import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ReconciliationView, RevisionLifecycle } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { labelOf, REVISION_LIFECYCLE_LABELS } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { StatusTone } from '@/features/ux-kit/status-tone';
import { EditorProblem } from '../editor/editor-problem';
import type { WorkflowActions } from '../hooks/use-workflow-actions';
import { submitBlockers } from '../model/workflow-blockers';
import { RecomputeState } from './recompute-state';

export interface StickyWorkflowBarProps {
  view: ReconciliationView;
  actions: WorkflowActions;
  /** `/plans/…/periods/…/review?…` — the full workflow (approve, reject, reopen, holds) */
  reviewHref: string | null;
  unsavedLines: boolean;
  /** the full workflow bar is on screen (Review & close): only state and recompute progress here */
  compact: boolean;
}

const LIFECYCLE_TONES: Readonly<Record<RevisionLifecycle, StatusTone>> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  cancelled: 'neutral',
};

const BLOCKERS_ID = 'sticky-submit-blockers';

function SubmitControl({ actions, reason }: { actions: WorkflowActions; reason: string }) {
  return (
    <>
      <Button size="sm" data-testid="sticky-submit" disabled={actions.pending !== null || reason !== ''} aria-describedby={reason ? BLOCKERS_ID : undefined} onClick={() => void actions.submit()}>
        Submit for approval
      </Button>
      <DisabledReason id={BLOCKERS_ID} reason={reason} />
    </>
  );
}

/**
 * Compact workflow strip pinned to the top of every period section (UX audit D-10, L4): the revision's
 * lifecycle, Submit with what blocks it, and the recompute job's state. It shares the workspace's
 * commands with the full workflow bar, so a recompute started in one shows in the other. The link to
 * Review & close is left out for users who cannot open it (an operator reaches only Actuals & quality).
 */
export function StickyWorkflowBar({ view, actions, reviewHref, unsavedLines, compact }: StickyWorkflowBarProps) {
  const { canWritePeriods, canViewAnalysis } = useCapabilities();
  const lifecycle = view.revision.lifecycle;
  const canSubmit = canWritePeriods && lifecycle === 'draft' && !compact;
  const reason = submitBlockers(view, unsavedLines).map((b) => b.text).join(' ');
  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-md border bg-background/95 px-2 py-1.5 text-sm shadow-sm backdrop-blur" data-testid="sticky-workflow-bar" data-lifecycle={lifecycle} role="region" aria-label="Period workflow">
      <StatusBadge tone={LIFECYCLE_TONES[lifecycle]} data-testid="sticky-lifecycle" data-lifecycle={lifecycle}>
        Revision {view.revision.revision} · {labelOf(REVISION_LIFECYCLE_LABELS, lifecycle)}
        {view.revision.isStale ? ' · inputs changed' : ''}
      </StatusBadge>
      {canSubmit && <SubmitControl actions={actions} reason={reason} />}
      <RecomputeState state={actions.recomputeState} testId="sticky-recompute-state" />
      {reviewHref && canViewAnalysis && (
        <Link className="ml-auto text-xs font-medium text-primary underline underline-offset-4" to={reviewHref} data-testid="sticky-review-link">
          Approval, holds and day certification: Review & close
        </Link>
      )}
      {!compact && actions.problem && <div className="basis-full"><EditorProblem problem={actions.problem} /></div>}
    </div>
  );
}
