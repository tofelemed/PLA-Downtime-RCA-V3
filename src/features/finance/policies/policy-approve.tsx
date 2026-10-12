import { useState } from 'react';
import { useApproveValuationPolicy } from '@/api/v2/queries/valuation';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';
import { currenciesLabel, type PolicyStatus } from '../model/policy-status';

export interface PolicyApproveProps {
  policy: ValuationPolicyView;
  status: PolicyStatus;
}

/**
 * The finance sign-off of one version (VAL01) after a confirmation. The server checks role, access to
 * the whole plant and separation of duties (403 for the author); a refusal keeps the dialog open with
 * the reason. Only manager approvers see it; the author sees it disabled with the reason.
 */
export function PolicyApprove({ policy, status }: PolicyApproveProps) {
  const approve = useApproveValuationPolicy();
  const [open, setOpen] = useState(false);
  const access = approvalAccess(useCapabilities().canManagePolicies, policy.createdBy, useCurrentUserId());
  if (status !== 'unapproved' || access === 'hidden') return null;
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) approve.reset();
  };
  return (
    <>
      <ApproveButton access={access} onClick={() => setOpen(true)} data-testid="policy-approve-start">
        Approve…
      </ApproveButton>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Approve version ${policy.version}?`}
        description={`Version ${policy.version} (${currenciesLabel(policy)}) becomes the valuation basis from its start. This is the finance sign-off and cannot be undone here. Periods are revalued only when they are next recalculated.`}
        confirmLabel={`Approve version ${policy.version}`}
        onConfirm={() => approve.submit({ id: policy.id })}
      >
        {approve.error ? <FinanceRefusalAlert error={approve.error} /> : null}
      </ConfirmDialog>
    </>
  );
}
