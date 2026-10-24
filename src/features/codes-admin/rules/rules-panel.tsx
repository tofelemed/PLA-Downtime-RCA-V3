import { useNavigate } from 'react-router-dom';
import { useRules } from '@/api/v2/queries/rules';
import type { RuleKind, RuleState, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { RcaCard } from '@/features/rca/components/rca-card';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, RULE_KIND_LABELS, RULE_STATE_LABELS } from '@/features/ux-kit/labels';
import { useUrlParam } from '../hooks/use-url-param';

const STATES = ['', 'draft', 'active', 'retired'] as const;
const KINDS = ['', 'coding_default', 'status_derivation', 'rca_trigger_hint', 'validation'] as const;
const STATE_OPTIONS = STATES.filter(Boolean).map((value) => ({ value, label: RULE_STATE_LABELS[value as RuleState] }));
const KIND_OPTIONS = KINDS.filter(Boolean).map((value) => ({ value, label: RULE_KIND_LABELS[value as RuleKind] }));

/** The activation rule, behind the ⓘ of the Rules card and of the New rule page. */
export const RULES_INFO = 'A rule is saved as a draft and applies only after a second person activates it. Every change is kept as a version.';

const COLUMNS: Array<DataTableColumn<RuleView>> = [
  { id: 'name', header: 'Name', cell: (rule) => <span data-testid="rule-item" data-name={rule.name} data-state={rule.state}>{rule.name}</span> },
  { id: 'kind', header: 'Kind', cell: (rule) => labelOf(RULE_KIND_LABELS, rule.kind) },
  { id: 'state', header: 'State', cell: (rule) => <Badge className="whitespace-nowrap" variant={rule.state === 'active' ? 'outline' : 'secondary'}>{labelOf(RULE_STATE_LABELS, rule.state)}</Badge> },
  { id: 'version', header: 'In force', nowrap: true, cell: (rule) => (rule.activeVersion === null ? '—' : `Version ${rule.activeVersion}`) },
  { id: 'draft', header: 'Draft waiting', cell: (rule) => (rule.draft ? 'Yes' : '—') },
  { id: 'priority', header: 'Priority', align: 'right', cell: (rule) => rule.priority },
];

/** State and kind filters (in the URL), labels above, h-9. */
function RuleFilters() {
  const [state, setState] = useUrlParam('state', STATES, '');
  const [kind, setKind] = useUrlParam('kind', KINDS, '');
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="rule-filters">
      <div className={`${FIELD_CLASS} w-44`}>
        <Label htmlFor="rule-state-filter">State</Label>
        <NativeSelect id="rule-state-filter" value={state} onChange={(value) => setState(value as RuleState)} placeholder="All states" options={STATE_OPTIONS} />
      </div>
      <div className={`${FIELD_CLASS} w-52`}>
        <Label htmlFor="rule-kind-filter">Kind</Label>
        <NativeSelect id="rule-kind-filter" value={kind} onChange={(value) => setKind(value as RuleKind)} placeholder="All kinds" options={KIND_OPTIONS} />
      </div>
    </div>
  );
}

/**
 * Declarative admin rules (plan 3.8, NFR02), 20 per page with state and kind filters in the URL; a row
 * opens the rule's page. Rules are data the server validates and evaluates; nothing here executes one.
 */
export function RulesPanel() {
  const navigate = useNavigate();
  const [state] = useUrlParam('state', STATES, '');
  const [kind] = useUrlParam('kind', KINDS, '');
  const rules = useRules({ state: state || undefined, kind: kind || undefined });
  return (
    <div className="space-y-4" data-testid="rules-panel">
      <RuleFilters />
      <RcaCard title="Rules" info={RULES_INFO} testId="rules-card">
        <DataTable
          caption="Rules"
          columns={COLUMNS}
          rows={rules.rows}
          getRowKey={(rule) => rule.id}
          pager={rules.pager}
          status={rules.status}
          empty={{ title: 'No rules yet', text: state || kind ? 'No rule matches these filters.' : 'No rules yet.' }}
          onRowClick={(rule) => navigate(`/master-data/codes-rules/rules/${rule.id}`)}
          rowLabel={(rule) => `Rule ${rule.name}`}
        />
      </RcaCard>
    </div>
  );
}
