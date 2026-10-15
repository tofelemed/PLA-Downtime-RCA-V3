import { useMonthCloseStep } from '@/api/v2/queries/month-close';
import type { MonthCloseStep, MonthCloseView } from '@/api/v2/types/month-close';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { StepConfirm } from './step-confirm';

/** Which steps the user may try in this state (display only — the server decides and refuses). */
function stepsOf(view: MonthCloseView, caps: ReturnType<typeof useCapabilities>) {
  const { state, signOffs } = view;
  const needsReview = signOffs.materialityRequired && !signOffs.materialityReviewedBy;
  return {
    close: state === 'open' && caps.canCloseMonthQuantities,
    review: state === 'quantities_closed' && needsReview && caps.canReviewMonthMateriality,
    signOff: state === 'quantities_closed' && caps.canSignOffMonth,
    lock: state === 'finance_signed_off' && caps.canSignOffMonth,
    reopen: (state === 'quantities_closed' || state === 'finance_signed_off') && caps.canReopenMonth,
    needsReview,
  };
}

/** The month close steps of the signed-in user, each behind a confirmation; refusals are shown in words. */
export function CloseActions({ view }: { view: MonthCloseView }) {
  const caps = useCapabilities();
  const userId = useCurrentUserId();
  const command = useMonthCloseStep();
  const steps = stepsOf(view, caps);
  const run = (step: MonthCloseStep) => (text: string) => command.submit({ month: view.monthKey, step, text });
  const signedQuantities = userId !== null && view.signOffs.quantitiesClosedBy?.id === userId;
  const busy = command.isPending;
  const problem = command.error ? <FriendlyErrorAlert error={command.error} /> : null;
  return (
    <div className="space-y-2" data-testid="close-actions">
      <div className="flex flex-wrap gap-2">
        {steps.close && (
          <StepConfirm trigger="Close quantities…" testId="step-close-quantities" disabled={busy || !view.prerequisites.met} title={`Close the quantities of ${view.monthKey}?`} description="You confirm every period of the month is approved. Finance signs off next; nobody can revise the month's periods until it is reopened." confirmLabel="Close quantities" onConfirm={run('close-quantities')}>
            {problem}
          </StepConfirm>
        )}
        {steps.review && (
          <StepConfirm trigger="Review materiality…" testId="step-materiality-review" disabled={busy} title="Confirm the material adjustments?" description="The month's adjustments reach the materiality threshold; your review comes before the finance sign-off." confirmLabel="Confirm review" onConfirm={run('materiality-review')}>
            {problem}
          </StepConfirm>
        )}
        {steps.signOff && (
          <StepConfirm trigger="Finance sign-off…" testId="step-finance-sign-off" disabled={busy || steps.needsReview || signedQuantities} title={`Sign off ${view.monthKey} for finance?`} description="Finance signs off independently of the quantity close." confirmLabel="Sign off" onConfirm={run('finance-sign-off')}>
            {problem}
          </StepConfirm>
        )}
        {steps.lock && (
          <StepConfirm trigger="Lock month…" testId="step-lock" disabled={busy} title={`Lock ${view.monthKey}?`} description="After the lock, approved periods change only through change proposals, marked after close. A locked month is never reopened." confirmLabel="Lock month" onConfirm={run('lock')}>
            {problem}
          </StepConfirm>
        )}
        {steps.reopen && (
          <StepConfirm trigger="Reopen…" testId="step-reopen" destructive textRequired disabled={busy} title={`Reopen ${view.monthKey}?`} description="Every sign-off is cleared; the month is closed again from the start." confirmLabel="Reopen month" onConfirm={run('reopen')}>
            {problem}
          </StepConfirm>
        )}
      </div>
      {steps.close && !view.prerequisites.met && <p className="text-sm text-muted-foreground" data-testid="close-blocked">Approve every period (and settle open change proposals) before closing the quantities.</p>}
      {steps.signOff && signedQuantities && <p className="text-sm text-muted-foreground" data-testid="close-sod">You closed the quantities; finance sign-off needs someone else.</p>}
      {problem}
    </div>
  );
}
