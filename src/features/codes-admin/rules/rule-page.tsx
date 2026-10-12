import { useParams } from 'react-router-dom';
import { useRule, useRulesSchema } from '@/api/v2/queries/rules';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { RuleDetail } from './rule-detail';

/** `/codes-admin/rules/:ruleId`: one declarative rule with builder, simulation and versions. */
export function RulePage() {
  const { ruleId } = useParams();
  const schema = useRulesSchema();
  const rule = useRule(ruleId ?? null);
  const currentUserId = useCurrentUserId();
  if (!schema.data || !rule.data) {
    const failed = schema.isError ? schema : rule;
    return (
      <Page>
        <PageHeader title="Rule" back={{ to: '/codes-admin?tab=rules', label: 'Rules' }} />
        <DataState state={dataStateOf(failed.isError ? failed : { isLoading: true, isError: false, error: null })} error={failed.error} onRetry={() => void failed.refetch()} />
      </Page>
    );
  }
  return (
    <Page>
      <RuleDetail rule={rule.data} schema={schema.data} currentUserId={currentUserId} />
    </Page>
  );
}
