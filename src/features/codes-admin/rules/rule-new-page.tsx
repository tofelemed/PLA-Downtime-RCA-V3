import { useRulesSchema } from '@/api/v2/queries/rules';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { MasterDataNav } from '@/features/master-data/components/master-data-nav';
import { RULES_LIST_PATH } from '../model/codes-save-result';
import { RuleEditor } from './rule-editor';
import { RULES_INFO } from './rules-panel';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

/** `/master-data/codes-rules/rules/new`: the builder for a new rule draft; saving ends in the result dialog. */
export function RuleNewPage() {
  const schema = useRulesSchema();
  return (
    <Page>
      <PageHeader
        title="New rule"
        back={{ to: RULES_LIST_PATH, label: 'Rules' }}
        titleAside={<KpiInfo label="new rules" text={RULES_INFO} />}
      />
      <MasterDataNav />
      <DataState state={dataStateOf(schema)} error={schema.error} onRetry={() => void schema.refetch()}>
        {schema.data && <RuleEditor schema={schema.data} rule={null} />}
      </DataState>
    </Page>
  );
}
