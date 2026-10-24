import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAnyApprovedPolicy, useValuationPolicies } from '@/api/v2/queries/valuation';
import { StatusIcon } from '@/lib/icons';
import { InfoMark } from '@/features/plans-profiles-calendars/components/info-mark';
import { TableCard } from '@/features/plans-profiles-calendars/components/table-card';
import { PolicyTable } from './policy-table';

const APPROVED_INFO = 'A valuation policy version is approved. Valuation uses the newest approved version in force; a newer version that is not approved never replaces it.';

/** With an approved version, what that means sits behind the ⓘ of the table title (the banner's test id stays). */
function ApprovedInfo() {
  return <InfoMark label="the approved policy" text={APPROVED_INFO} testId="policy-banner" data={{ 'data-approved': 'true' }} />;
}

/** No approved version yet: every loss stays "unvalued (policy pending)", said as a warning above the table. */
function NotApprovedBanner() {
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
  const approved = useAnyApprovedPolicy();
  return (
    <div className="space-y-4" data-testid="policies-tab">
      {approved.data === false && <NotApprovedBanner />}
      <TableCard title="Valuation policy versions" actions={approved.data ? <ApprovedInfo /> : undefined}>
        <PolicyTable policies={policies.rows} pager={policies.pager} status={policies.status} />
      </TableCard>
    </div>
  );
}
