import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApprovePlan } from '@/api/v2/queries/plans';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { RefusalNotice } from '../components/refusal-notice';
import { useReturnPlan } from '../hooks/use-plan-review';
import { RequiredMarker } from '@/features/ux-kit/form-field';

export interface ApprovePlanVersionProps {
  version: PlanVersionView;
  timezone: string;
}

function ReturnToAuthor({ version, timezone, disabled }: ApprovePlanVersionProps & { disabled: boolean }) {
  const back = useReturnPlan();
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
        trigger={
          <Button variant="outline" disabled={disabled} data-testid="plan-return">
            Return to author…
          </Button>
        }
        title={`Return version ${version.version} to its author?`}
        description="The version goes back to draft. The author sees your reason and can change and resubmit it."
        confirmLabel="Return version"
        destructive
        confirmDisabled={!reason.trim()}
        onConfirm={() => back.submit({ planId: version.planId, expectedVersion: version.version, reason: reason.trim() }).then(() => setReason(''))}
      >
        <div className="space-y-1">
          <Label htmlFor="planReturnReason">Reason<RequiredMarker /></Label>
          <Textarea id="planReturnReason" data-testid="plan-return-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <RefusalNotice error={back.error} timezone={timezone} />
      </ConfirmDialog>
  );
}

/**
 * Approves or returns the reviewed version. Who may is the server's decision: a refusal (role, overlap
 * with another approved plan, periods not generated, separation of duties) is shown, not hidden.
 */
export function ApprovePlanVersion({ version, timezone }: ApprovePlanVersionProps) {
  const approve = useApprovePlan();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { canApprovePlans, isSuperAdmin } = useCapabilities();
  const access = approvalAccess(canApprovePlans, version.createdBy, useCurrentUserId(), isSuperAdmin);
  if (access === 'hidden') return null;
  const submit = () => approve.submit({ planId: version.planId, expectedVersion: version.version, reason: reason.trim() || undefined });
  return (
    <div className="space-y-2" data-testid="approve-plan">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-72 space-y-1">
          <Label htmlFor="planApprovalReason">Approval reason (optional)</Label>
          <Input id="planApprovalReason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <ApproveButton access={access} onClick={() => setConfirming(true)} disabled={approve.isPending} data-testid="approve-plan-submit">
          Approve version {version.version}…
        </ApproveButton>
        {version.approvalState === 'submitted' && <ReturnToAuthor version={version} timezone={timezone} disabled={access !== 'allowed'} />}
      </div>
      <RefusalNotice error={approve.error} timezone={timezone} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Approve plan version ${version.version}?`}
        description={reason.trim() ? `Approval reason: “${reason.trim()}”. The approved version becomes the plan of record for its periods.` : 'The approved version becomes the plan of record for its periods.'}
        confirmLabel="Approve version"
        onConfirm={submit}
      >
        <RefusalNotice error={approve.error} timezone={timezone} />
      </ConfirmDialog>
    </div>
  );
}
