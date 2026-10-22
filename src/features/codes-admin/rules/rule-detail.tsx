import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { labelOf, RULE_KIND_LABELS, RULE_STATE_LABELS } from '@/features/ux-kit/labels';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { MasterDataNav } from '@/features/master-data/components/master-data-nav';
import { useUrlParam } from '../hooks/use-url-param';
import { RULES_LIST_PATH } from '../model/codes-save-result';
import { RuleActions } from './rule-actions';
import { RuleEditor } from './rule-editor';
import { RuleVersions } from './rule-versions';
import { SimulationPanel } from './simulation-panel';

export interface RuleDetailProps {
  rule: RuleView;
  schema: RulesSchemaView;
  currentUserId: string | null;
}

const TABS = ['builder', 'simulation', 'versions'] as const;
type RuleTab = (typeof TABS)[number];

function RuleSummary({ rule, ownDraft }: { rule: RuleView; ownDraft: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={rule.state === 'active' ? 'outline' : 'secondary'}>{labelOf(RULE_STATE_LABELS, rule.state)}</Badge>
      <span>{labelOf(RULE_KIND_LABELS, rule.kind)}</span>
      {rule.activeVersion !== null && <Badge variant="outline">Version {rule.activeVersion} in force</Badge>}
      {rule.draft && <Badge variant="secondary">Draft waiting{ownDraft ? ' (yours)' : ''}</Badge>}
    </span>
  );
}

/**
 * One rule: header with activation and retirement, then builder, simulation and version history as
 * tabs in the URL (`?tab=`).
 */
export function RuleDetail({ rule, schema, currentUserId }: RuleDetailProps) {
  const [tab, setTab] = useUrlParam<RuleTab>('tab', TABS, 'builder');
  const ownDraft = Boolean(rule.draft && rule.draft.authorId === currentUserId);
  return (
    <div className="space-y-6" data-testid="rule-detail" data-state={rule.state} data-active-version={rule.activeVersion ?? ''} data-has-draft={Boolean(rule.draft)}>
      <PageHeader
        title={rule.name}
        back={{ to: RULES_LIST_PATH, label: 'Rules' }}
        description={<RuleSummary rule={rule} ownDraft={ownDraft} />}
        actions={<RuleActions rule={rule} currentUserId={currentUserId} />}
      />
      <MasterDataNav />
      <Tabs value={tab} onValueChange={(value) => setTab(value as RuleTab)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="builder" data-testid="tab-builder">Builder</TabsTrigger>
          <TabsTrigger value="simulation" data-testid="tab-simulation">Simulation</TabsTrigger>
          <TabsTrigger value="versions" data-testid="tab-rule-versions">Versions</TabsTrigger>
        </TabsList>
        <TabsContent value="builder" className="pt-4">
          <RuleEditor key={`${rule.id}:${rule.rowVersion}`} schema={schema} rule={rule} />
        </TabsContent>
        <TabsContent value="simulation" className="pt-4">
          <SimulationPanel key={`${rule.id}:${rule.rowVersion}`} rule={rule} schema={schema} />
        </TabsContent>
        <TabsContent value="versions" className="pt-4">
          <RuleVersions rule={rule} schema={schema} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
