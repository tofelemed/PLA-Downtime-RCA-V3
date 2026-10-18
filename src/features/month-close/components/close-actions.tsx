import { useMonthCloseStep } from '@/api/v2/queries/month-close';
import type { MonthCloseStep, MonthCloseView } from '@/api/v2/types/month-close';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useCalendarPreference } from '@/lib/dates';
import { monthLabelOf } from '../model/month-label';
import { CloseMonthEnd } from './close-month-end';
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

/** Keeps only the steps an embedding page offers (the approval page shows the one step waiting). */
function onlySteps(steps: ReturnType<typeof stepsOf>, only?: readonly MonthCloseStep[]) {
  if (!only) return steps;
  return {
    ...steps,
    close: steps.close && only.includes('close-quantities'),
    review: steps.review && only.includes('materiality-review'),
    signOff: steps.signOff && only.includes('finance-sign-off'),
    lock: steps.lock && only.includes('lock'),
    reopen: steps.reopen && only.includes('reopen'),
  };
}

/** The month close steps of the signed-in user, each behind a confirmation; refusals are shown in words. */
export function CloseActions({ view, only }: { view: MonthCloseView; only?: readonly MonthCloseStep[] }) {
  const caps = useCapabilities();
  const userId = useCurrentUserId();
  const command = useMonthCloseStep();
  const steps = onlySteps(stepsOf(view, caps), only);
  const run = (step: MonthCloseStep) => (text: string) => command.submit({ month: view.monthKey, step, text });
  const signedQuantities = !caps.isSuperAdmin && userId !== null && view.signOffs.quantitiesClosedBy?.id === userId;
  const busy = command.isPending;
  const month = monthLabelOf(view.monthKey, view.calendar, useCalendarPreference().digits);
  const problem = command.error ? <FriendlyErrorAlert error={command.error} /> : null;
  return (
    <div id="close-actions" className="scroll-mt-24 space-y-2" data-testid="close-actions">
      <div className="flex flex-wrap gap-2">
        {steps.close && (
          <StepConfirm trigger="Close quantities…" testId="step-close-quantities" disabled={busy || !view.prerequisites.met} title={`Close the quantities of ${month}?`} description="You confirm every period of the month is approved. Finance signs off next; nobody can revise the month's periods until it is reopened." confirmLabel="Close quantities" onConfirm={run('close-quantities')}>
            {problem}
          </StepConfirm>
        )}
        {steps.review && (
          <StepConfirm trigger="Review materiality…" testId="step-materiality-review" disabled={busy} title="Confirm the material adjustments?" description="The month's adjustments reach the materiality threshold; your review comes before the finance sign-off." confirmLabel="Confirm review" onConfirm={run('materiality-review')}>
            {problem}
          </StepConfirm>
        )}
        {steps.signOff && (
          <StepConfirm trigger="Finance sign-off…" testId="step-finance-sign-off" disabled={busy || steps.needsReview || signedQuantities} title={`Sign off ${month} for finance?`} description="Record the finance sign-off. SuperAdmin may also have closed the quantities; other signers must be independent." confirmLabel="Sign off" onConfirm={run('finance-sign-off')}>
            {problem}
          </StepConfirm>
        )}
        {steps.lock && (
          <StepConfirm trigger="Lock month…" testId="step-lock" destructive typedConfirmation={month} disabled={busy} title={`Lock ${month}?`} description="This cannot be undone: a locked month is never reopened. After the lock, approved periods change only through change proposals, marked after close." confirmLabel="Lock month" onConfirm={run('lock')}>
            {problem}
          </StepConfirm>
        )}
        {steps.reopen && (
          <StepConfirm trigger="Reopen…" testId="step-reopen" destructive textRequired disabled={busy} title={`Reopen ${month}?`} description="Every sign-off is cleared; the month is closed again from the start." confirmLabel="Reopen month" onConfirm={run('reopen')}>
            {problem}
          </StepConfirm>
        )}
      </div>
      {steps.close && <CloseMonthEnd view={view} />}
      {steps.close && !view.prerequisites.met && <p className="text-sm text-muted-foreground" data-testid="close-blocked">Resolve the blocking prerequisites shown above before closing the quantities.</p>}
      {steps.signOff && signedQuantities && <p className="text-sm text-muted-foreground" data-testid="close-sod">You closed the quantities; finance sign-off needs someone else.</p>}
      {problem}
    </div>
  );
}
