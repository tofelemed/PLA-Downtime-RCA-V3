import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApproveValuationPolicy } from '@/api/v2/queries/valuation';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';
import type { PolicyStatus } from '../model/policy-status';

export interface PolicyApproveProps {
  policy: ValuationPolicyView;
  status: PolicyStatus;
  timezone: string;
}

/**
 * The finance sign-off of one version (VAL01) after an explicit confirmation. The server checks role,
 * tenant-wide grant and separation of duties (403 SEPARATION_OF_DUTIES for the author), shown as is.
 */
export function PolicyApprove({ policy, status, timezone }: PolicyApproveProps) {
  const approve = useApproveValuationPolicy();
  const [confirming, setConfirming] = useState(false);
  if (status === 'approved') return <span className="text-xs text-muted-foreground">Approved — immutable</span>;
  if (status === 'placeholder') return <span className="text-xs text-muted-foreground">History — no currency, cannot be approved</span>;
  const submit = () => approve.submit({ id: policy.id }).then(() => setConfirming(false)).catch(() => undefined);
  return (
    <div className="space-y-2" data-testid="policy-approve">
      {!confirming ? (
        <Button size="sm" onClick={() => setConfirming(true)} data-testid="policy-approve-start">
          Approve…
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border p-2 text-xs" data-testid="policy-approve-confirm">
          <p>
            Approve v{policy.version} ({policy.reportingCurrencies.join(' + ')}) as the valuation basis from its start? This is the finance sign-off;
            it is not undone here. Periods are revalued only on their next recalculation.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={approve.isPending} data-testid="policy-approve-submit">
              Approve v{policy.version}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <RefusalNotice error={approve.error} timezone={timezone} />
    </div>
  );
}
