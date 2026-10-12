import { Button } from '@/components/ui/button';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { ActionIcon } from '@/lib/icons';
import { RefusalNotice } from '../components/refusal-notice';
import { useSubmitPlan } from '../hooks/use-plan-review';

/** "Submit for approval" of a draft version: it then waits for a manager approver (approve or return). */
export function SubmitPlanVersion({ version, timezone }: { version: PlanVersionView; timezone: string }) {
  const submit = useSubmitPlan();
  if (version.approvalState !== 'draft') return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        data-testid="plan-submit"
        disabled={submit.isPending}
        onClick={() => void submit.submit({ planId: version.planId, expectedVersion: version.version }).catch(() => undefined)}
      >
        <ActionIcon.submit className="h-4 w-4" aria-hidden="true" />
        Submit for approval
      </Button>
      {submit.error !== null && (
        <div className="basis-full">
          <RefusalNotice error={submit.error} timezone={timezone} />
        </div>
      )}
    </>
  );
}
