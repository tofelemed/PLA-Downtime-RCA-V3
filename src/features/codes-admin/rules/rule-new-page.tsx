import { useRulesSchema } from '@/api/v2/queries/rules';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { RuleEditor } from './rule-editor';

/** `/master-data/codes-rules/rules/new`: the builder for a new rule draft; saving ends in the result dialog. */
export function RuleNewPage() {
  const schema = useRulesSchema();
  return (
    <Page>
      <PageHeader
        title="New rule"
        back={{ to: '/master-data/codes-rules?tab=rules', label: 'Rules' }}
        description="A new rule is saved as a draft. It applies only after a second person activates it."
      />
      <DataState state={dataStateOf(schema)} error={schema.error} onRetry={() => void schema.refetch()}>
        {schema.data && <RuleEditor schema={schema.data} rule={null} />}
      </DataState>
    </Page>
  );
}
