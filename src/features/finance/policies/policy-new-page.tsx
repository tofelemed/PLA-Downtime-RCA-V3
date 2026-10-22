import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValuationPolicies, useValuationPolicy } from '@/api/v2/queries/valuation';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { selfApprovalNote } from '@/features/ux-kit/format/self-approval-note';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useSaveResult } from '@/features/ux-kit/save-result';
import { POLICIES_PATH, policyVersionResult } from '../model/finance-save-results';
import { inForceBasis } from '../model/policy-form';
import { FinanceAreaTabs } from '../components/finance-area-tabs';
import { PolicyForm } from './policy-form';

const BACK = { to: POLICIES_PATH, label: 'Valuation policy' };

/**
 * `/finance/policies/new` (`?from=<version>` copies a stored version): a new valuation policy version,
 * saved as not approved. Saving ends in the result dialog (View policy version · Back to Valuation · Next);
 * dismissing it opens the new version's page, so a second save cannot duplicate it.
 */
export function PolicyNewPage() {
  const navigate = useNavigate();
  const capabilities = useCapabilities();
  const { isSuperAdmin } = capabilities;
  const result = useSaveResult();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const source = useValuationPolicy(fromId);
  const policies = useValuationPolicies();
  const title = source.data ? `New version from version ${source.data.version}` : 'New valuation policy version';
  // a fresh version starts from the basis in force (QA L19), so wait for the list once
  const waiting = fromId !== null ? !source.data : policies.query.isLoading;
  return (
    <Page>
      <PageHeader title={title} back={BACK} description={`Approve the new version before it values losses.${selfApprovalNote(isSuperAdmin, 'version')}`} />
      <FinanceAreaTabs current="policies" />
      {waiting ? (
        <DataState state={fromId !== null ? dataStateOf(source) : 'loading'} error={source.error} onRetry={() => void source.refetch()} />
      ) : (
        <PolicyForm
          key={source.data?.id ?? 'fresh'}
          source={source.data ?? null}
          freshBasis={fromId === null ? inForceBasis(policies.rows) : null}
          onSaved={(policy) => result.open(policyVersionResult(policy, capabilities, () => navigate(`/finance/policies/${policy.id}`, { replace: true })))}
          cancelTo={POLICIES_PATH}
        />
      )}
      {result.element}
    </Page>
  );
}
