import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApprovePlan } from '@/api/v2/queries/plans';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { RefusalNotice } from '../components/refusal-notice';

export interface ApprovePlanVersionProps {
  version: PlanVersionView;
  timezone: string;
}

/**
 * Approves the reviewed version (PLAN04). Who may approve is the server's decision: a refusal (403 role,
 * 409 PLAN_OVERLAP with the conflicting plan versions, 409 PERIODS_NOT_GENERATED) is shown, not hidden.
 */
export function ApprovePlanVersion({ version, timezone }: ApprovePlanVersionProps) {
  const approve = useApprovePlan();
  const [reason, setReason] = useState('');
  const submit = () => approve.submit({ planId: version.planId, expectedVersion: version.version, reason: reason.trim() || undefined }).catch(() => undefined);
  return (
    <div className="space-y-2" data-testid="approve-plan">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" aria-label="Approval reason" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={submit} disabled={approve.isPending} data-testid="approve-plan-submit">
          Approve version {version.version}
        </Button>
      </div>
      <RefusalNotice error={approve.error} timezone={timezone} />
    </div>
  );
}
