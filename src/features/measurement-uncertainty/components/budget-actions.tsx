import { useAdoptBudgetAsTolerance, useDecideUncertaintyBudget } from '@/api/v2/queries/uncertainty-budgets';
import type { UncertaintyBudgetView } from '@/api/v2/types/uncertainty';
import { Button } from '@/components/ui/button';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ReasonConfirm } from '@/features/plan-dashboard/workflow/reason-confirm';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/**
 * Approve / reject a proposed budget (metrology / instrumentation owner, never its author) and adopt an approved
 * budget in force as the unit's absolute reconciliation tolerance — an explicit decision, never automatic.
 */
export function BudgetActions({ budget }: { budget: UncertaintyBudgetView }) {
  const { canApproveUncertaintyBudgets, canAdoptTolerance } = useCapabilities();
  const userId = useCurrentUserId();
  const decide = useDecideUncertaintyBudget();
  const adopt = useAdoptBudgetAsTolerance();
  const approve = approvalAccess(canApproveUncertaintyBudgets, budget.authorId, userId);
  const adoption = approvalAccess(canAdoptTolerance, budget.authorId, userId);
  const busy = decide.isPending || adopt.isPending;
  const format = useNumberFormat();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {budget.state === 'proposed' && (
          <>
            <ApproveButton access={approve} size="sm" disabled={busy} data-testid="budget-approve" onClick={() => void decide.submit({ id: budget.id, decision: 'approve' }).catch(() => undefined)}>
              Approve
            </ApproveButton>
            <ReasonConfirm
              trigger="Reject…"
              triggerTestId="budget-reject"
              disabled={busy || approve !== 'allowed'}
              title="Reject this budget?"
              description="The author sees your reason; the budget in force stays as it is."
              confirmLabel="Reject budget"
              destructive
              onConfirm={(reason) => decide.submit({ id: budget.id, decision: 'reject', reason })}
            />
          </>
        )}
        {budget.inForce && adoption === 'allowed' && !budget.reviewOverdue && (
          <ConfirmDialog
            trigger={<Button size="sm" variant="outline" data-testid="budget-adopt">Use as tolerance…</Button>}
            title="Make the expanded uncertainty the unit's tolerance?"
            description={`A new reconciliation tolerance version for this unit takes effect now: absolute, ${format.decimal(budget.expandedUncertainty, 3)} ${budget.uom}. Residuals are still published; periods already calculated keep their version.`}
            confirmLabel="Use as tolerance"
            onConfirm={() => adopt.submit({ id: budget.id }).then(() => undefined)}
          />
        )}
      </div>
      {decide.error !== null && <FriendlyErrorAlert error={decide.error} title="The decision was not saved" />}
      {adopt.error !== null && <FriendlyErrorAlert error={adopt.error} title="The tolerance was not changed" />}
      {adopt.data && <p className="text-xs text-muted-foreground" data-testid="budget-adopted">Tolerance version {adopt.data.version} is in force for the unit.</p>}
    </div>
  );
}
