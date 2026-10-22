import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAnyApprovedPolicy, useValuationPolicies } from '@/api/v2/queries/valuation';
import { StatusIcon } from '@/lib/icons';
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
 * "New policy version" is in the page header (`FinanceHeaderActions`).
 */
export function PoliciesTab() {
  const policies = useValuationPolicies();
  return (
    <div className="space-y-4" data-testid="policies-tab">
      <ApprovalBanner />
      <PolicyTable policies={policies.rows} pager={policies.pager} status={policies.status} />
    </div>
  );
}
