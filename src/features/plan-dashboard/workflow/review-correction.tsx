import { useProposeCorrection } from '@/api/v2/queries/period-workflow';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { EditorProblem } from '../editor/editor-problem';
import { useCommandProblem } from '../hooks/use-command-problem';
import { periodRefOf } from '../hooks/use-draft-editor';
import { correctionDialogText } from '../model/month-lock';
import { ProposeCorrectionDialog, type CorrectionDraft } from './propose-correction-dialog';

/** Locked month: the change proposal flow (the same as History & exports). */
function LockedMonthCorrection({ view }: { view: ReconciliationView }) {
  const { canProposeCorrections, isSuperAdmin } = useCapabilities();
  const proposal = useProposeCorrection();
  const { problem, track } = useCommandProblem();
  const propose = (draft: CorrectionDraft) => track(proposal.submit({ period: periodRefOf(view), approvedRevision: view.publishedRevision ?? 0, ...draft }));
  const canPropose = canProposeCorrections && !view.openProposalId && view.publishedRevision !== null;
  return (
    <div className="space-y-2 text-sm" data-testid="review-correction">
      <p>The month is locked: approved figures change only through a correction proposal that another approver accepts.</p>
      {view.openProposalId && <p className="text-muted-foreground">A proposal is already open — see History &amp; exports.</p>}
      {canPropose && <ProposeCorrectionDialog onPropose={propose} description={correctionDialogText(view.monthClose, isSuperAdmin)} />}
      {!canProposeCorrections && <p className="text-muted-foreground">Production accounting or plant management can propose one.</p>}
      {problem && <EditorProblem problem={problem} />}
    </div>
  );
}

/**
 * UX D-7, in Review & close: how an approved period of a closed month is corrected. Locked month
 * (`proposal`): "Propose a correction…"; closing month (`none`): corrections are paused. Nothing while the
 * month allows a direct revision (or an older server does not say).
 */
export function ReviewCorrection({ view }: { view: ReconciliationView }) {
  const path = view.monthClose?.correctionPath;
  if (view.revision.lifecycle !== 'approved' || !path || path === 'direct') return null;
  if (path === 'proposal') return <LockedMonthCorrection view={view} />;
  return (
    <p className="text-sm text-muted-foreground" data-testid="correction-paused">
      Corrections are paused while the month is closing: reopen the month (Month close) or wait until it is locked, then propose a correction.
    </p>
  );
}
