import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAnyApprovedPolicy, useValuationPolicies } from '@/api/v2/queries/valuation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { PolicyTable } from './policy-table';

/** Whether finance has approved any version: until then every loss is "unvalued (policy pending)". */
function ApprovalBanner() {
  const approved = useAnyApprovedPolicy();
  if (approved.data === undefined) return null;
  if (approved.data) {
    return (
      <Alert data-testid="policy-banner" data-approved="true">
        <StatusIcon.success className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>A valuation policy version is approved</AlertTitle>
        <AlertDescription>Valuation uses the newest approved version in force; a newer version that is not approved never replaces it.</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" data-testid="policy-banner" data-approved="false">
      <StatusIcon.warning className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>No approved valuation policy — losses stay unvalued</AlertTitle>
      <AlertDescription>
        Nothing is valued until a manager approver with access to the whole plant, who did not write the version, approves a version that
        lists the reporting currencies (IRR and USD).
      </AlertDescription>
    </Alert>
  );
}

/**
 * Valuation policy versions of the plant (plan 2.6, VAL01): the finance sign-off is recorded on a
 * version's page. A change is a new version that is not approved yet (older ones are never rewritten).
 */
export function PoliciesTab() {
  const navigate = useNavigate();
  const { canMaintainValuation } = useCapabilities();
  const policies = useValuationPolicies();
  return (
    <div className="space-y-4" data-testid="policies-tab">
      <ApprovalBanner />
      <div className="flex flex-wrap items-center gap-2">
        <ReadOnlyHint />
        {canMaintainValuation && (
          <Button onClick={() => navigate('/finance/policies/new')} data-testid="policy-new">
            <ActionIcon.add aria-hidden="true" />
            New policy version
          </Button>
        )}
      </div>
      <PolicyTable policies={policies.rows} pager={policies.pager} status={policies.status} />
    </div>
  );
}
