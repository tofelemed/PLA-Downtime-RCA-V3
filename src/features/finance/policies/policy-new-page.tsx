import { useNavigate, useSearchParams } from 'react-router-dom';
import { useValuationPolicy } from '@/api/v2/queries/valuation';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PolicyForm } from './policy-form';

const BACK = { to: '/finance?tab=policies', label: 'Finance' };

/**
 * `/finance/policies/new` (`?from=<version>` copies a stored version): a new valuation policy version,
 * saved as not approved; saving opens the new version's page.
 */
export function PolicyNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const source = useValuationPolicy(fromId);
  const title = source.data ? `New version from version ${source.data.version}` : 'New valuation policy version';
  const waiting = fromId !== null && !source.data;
  return (
    <Page>
      <PageHeader title={title} back={BACK} description="Approve the new version before it values losses. SuperAdmin may approve their own version." />
      {waiting ? (
        <DataState state={dataStateOf(source)} error={source.error} onRetry={() => void source.refetch()} />
      ) : (
        <PolicyForm
          key={source.data?.id ?? 'fresh'}
          source={source.data ?? null}
          onSaved={(policy) => navigate(`/finance/policies/${policy.id}`, { replace: true })}
          onCancel={() => navigate(-1)}
        />
      )}
    </Page>
  );
}
