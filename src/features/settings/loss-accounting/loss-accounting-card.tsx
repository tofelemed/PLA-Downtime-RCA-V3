import { useState } from 'react';
import { useLossAccountingInForce } from '@/api/v2/queries/loss-accounting';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import { LossAccountingForm } from './loss-accounting-form';
import { lossAccountingSummary } from './loss-accounting-model';
import { LossAccountingVersions } from './loss-accounting-versions';
import { useUnitNames } from './use-unit-names';

export const LOSS_ACCOUNTING_INFO =
  'How the plant accounts its production losses: one period per shift or per day, and whether the loss is computed from measurements and stops or declared by OT. A change is a draft by the plant administrator or production accounting; it applies only once production accounting or the manager approves it.';

/**
 * Plant settings, "Loss accounting": the version in force in one line, a "Change…" draft form for writers and
 * the list of versions with Approve / Reject for approvers. Every rule (roles, separation of duties, which
 * version is in force) is the server's.
 */
export function LossAccountingCard() {
  const inForce = useLossAccountingInForce();
  const unitName = useUnitNames();
  const { canEditLossAccounting } = useCapabilities();
  const [changing, setChanging] = useState(false);
  const [listing, setListing] = useState(false);
  const policy = inForce.data?.policy;
  return (
    <DataState state={dataStateOf(inForce)} error={inForce.error} onRetry={() => void inForce.refetch()}>
      {policy && (
        <div className="space-y-3 text-sm">
          <p data-testid="loss-in-force">{lossAccountingSummary(policy, unitName(policy.accountingUnitId))}</p>
          <div className="flex flex-wrap items-center gap-2">
            {canEditLossAccounting && (
              <Button size="sm" onClick={() => setChanging(true)} data-testid="loss-change">
                Change…
              </Button>
            )}
            <Button size="sm" variant="outline" aria-expanded={listing} onClick={() => setListing((v) => !v)} data-testid="loss-versions-toggle">
              {listing ? 'Hide versions' : 'Versions'}
            </Button>
          </div>
          {listing && <LossAccountingVersions />}
          <EditorSheet open={changing} onOpenChange={setChanging} title="Change loss accounting" description="Saved as a draft; it applies once production accounting or the manager approves it.">
            <LossAccountingForm base={policy} onDone={() => setChanging(false)} />
          </EditorSheet>
        </div>
      )}
    </DataState>
  );
}
