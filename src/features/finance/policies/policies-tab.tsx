import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useValuationPolicies } from '@/api/v2/queries/valuation';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { LoadMore } from '@/features/plans-profiles-calendars/components/load-more';
import { anyApproved, policyStatus } from '../model/policy-status';
import { PolicyForm } from './policy-form';
import { PolicyTable } from './policy-table';

/** Whether finance has approved any version: until then every loss is "unvalued (policy pending)". */
function ApprovalBanner({ approved }: { approved: boolean }) {
  if (approved) {
    return (
      <Alert data-testid="policy-banner" data-approved="true">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>A valuation policy version is approved</AlertTitle>
        <AlertDescription>Valuation applies the highest approved version in force; a newer unapproved version never replaces it.</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" data-testid="policy-banner" data-approved="false">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>No approved valuation policy — losses stay unvalued (policy pending)</AlertTitle>
      <AlertDescription>
        Nothing is valued until a manager approver with a tenant-wide grant, who is not the version’s author, approves a version listing the
        reporting currencies (D08: IRR and USD).
      </AlertDescription>
    </Alert>
  );
}

/**
 * Valuation policy versions of the tenant (plan 2.6, VAL01, D08): the finance sign-off is recorded here.
 * A change is a new unapproved version (older ones are never rewritten); the v1 `XXX` placeholder is
 * history and cannot be approved.
 */
export function PoliciesTab({ timezone }: { timezone: string }) {
  const { canManagePolicies } = useCapabilities();
  const policies = useValuationPolicies();
  const [draftFrom, setDraftFrom] = useState<{ source: ValuationPolicyView | null } | null>(null);
  const newest = policies.items.find((policy) => policyStatus(policy) !== 'placeholder') ?? null;
  return (
    <div className="space-y-3" data-testid="policies-tab">
      {!policies.isLoading && !policies.isError && <ApprovalBanner approved={anyApproved(policies.items)} />}
      <ReadOnlyHint />
      {!draftFrom && canManagePolicies && (
        <Button size="sm" onClick={() => setDraftFrom({ source: newest })} data-testid="policy-new">
          New policy version
        </Button>
      )}
      {draftFrom && <PolicyForm source={draftFrom.source} timezone={timezone} onDone={() => setDraftFrom(null)} />}
      <DataState state={dataStateOf(policies, { isEmpty: policies.items.length === 0 })} error={policies.error} detail="No valuation policy versions.">
        <PolicyTable policies={policies.items} timezone={timezone} onCopy={(source) => setDraftFrom({ source })} />
        <LoadMore hasNextPage={policies.hasNextPage} isFetchingNextPage={policies.isFetchingNextPage} fetchNextPage={policies.fetchNextPage} />
      </DataState>
    </div>
  );
}
