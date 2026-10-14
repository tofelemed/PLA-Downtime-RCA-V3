import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFxTransition } from '@/api/v2/queries/valuation';
import type { FxRateView } from '@/api/v2/types/valuation';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';

type Pending = 'approve' | 'retire' | null;

/** "Supersede": close the one approved predecessor of the pair at this version's start. */
function SupersedeChoice({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(on) => onChange(on === true)} data-testid="fx-supersede" />
      <Label htmlFor={id}>End the approved rate it overlaps at this rate's start</Label>
    </div>
  );
}

/**
 * Approve / retire one exchange rate version, each after a confirmation. The server decides who may
 * (403) and whether it overlaps an approved version of the pair (409, the conflicting versions are
 * listed in the dialog). Only finance approvers see these actions (SME V1); the author sees approve disabled.
 */
export function FxVersionActions({ rate }: { rate: FxRateView }) {
  const { canApproveValuation } = useCapabilities();
  const access = approvalAccess(canApproveValuation, rate.createdBy, useCurrentUserId());
  const transition = useFxTransition();
  const [pending, setPending] = useState<Pending>(null);
  const [supersede, setSupersede] = useState(false);
  if (rate.state === 'retired' || !canApproveValuation) return null;
  const onOpenChange = (next: boolean) => {
    if (next) return;
    setPending(null);
    transition.reset();
  };
  const refusal = transition.error ? <FinanceRefusalAlert error={transition.error} /> : null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="fx-actions">
      {rate.state === 'draft' && (
        <ApproveButton access={access} onClick={() => setPending('approve')} data-testid="fx-approve">
          Approve…
        </ApproveButton>
      )}
      <Button variant="outline" onClick={() => setPending('retire')} data-testid="fx-retire">
        Retire…
      </Button>
      <ConfirmDialog
        open={pending === 'approve'}
        onOpenChange={onOpenChange}
        title={`Approve 1 ${rate.fromCurrency} = ${rate.rate} ${rate.toCurrency}?`}
        description="Valuation uses the approved rate for losses inside its validity. Approving queues a recalculation of the periods of its months; approved periods get a change proposal."
        confirmLabel="Approve rate"
        onConfirm={() => transition.submit({ id: rate.id, action: 'approve', supersede })}
      >
        <SupersedeChoice checked={supersede} onChange={setSupersede} />
        {refusal}
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === 'retire'}
        onOpenChange={onOpenChange}
        title={`Retire version ${rate.version}?`}
        description="A retired rate is no longer used for valuation. It stays in the history and cannot be approved again."
        confirmLabel="Retire rate"
        destructive
        onConfirm={() => transition.submit({ id: rate.id, action: 'retire' })}
      >
        {refusal}
      </ConfirmDialog>
    </div>
  );
}
