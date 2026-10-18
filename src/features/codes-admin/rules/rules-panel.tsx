import { useNavigate } from 'react-router-dom';
import { useRules } from '@/api/v2/queries/rules';
import type { RuleKind, RuleState, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, RULE_KIND_LABELS, RULE_STATE_LABELS } from '@/features/ux-kit/labels';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { useUrlParam } from '../hooks/use-url-param';

const STATES = ['', 'draft', 'active', 'retired'] as const;
const KINDS = ['', 'coding_default', 'status_derivation', 'rca_trigger_hint', 'validation'] as const;
const STATE_OPTIONS = STATES.filter(Boolean).map((value) => ({ value, label: RULE_STATE_LABELS[value as RuleState] }));
const KIND_OPTIONS = KINDS.filter(Boolean).map((value) => ({ value, label: RULE_KIND_LABELS[value as RuleKind] }));

const COLUMNS: Array<DataTableColumn<RuleView>> = [
  { id: 'name', header: 'Name', cell: (rule) => <span data-testid="rule-item" data-name={rule.name} data-state={rule.state}>{rule.name}</span> },
  { id: 'kind', header: 'Kind', cell: (rule) => labelOf(RULE_KIND_LABELS, rule.kind) },
  { id: 'state', header: 'State', cell: (rule) => <Badge variant={rule.state === 'active' ? 'outline' : 'secondary'}>{labelOf(RULE_STATE_LABELS, rule.state)}</Badge> },
  { id: 'version', header: 'In force', nowrap: true, cell: (rule) => (rule.activeVersion === null ? '—' : `Version ${rule.activeVersion}`) },
  { id: 'draft', header: 'Draft waiting', cell: (rule) => (rule.draft ? 'Yes' : '—') },
  { id: 'priority', header: 'Priority', align: 'right', cell: (rule) => rule.priority },
];

/**
 * Declarative admin rules (plan 3.8, NFR02), 20 per page with state and kind filters in the URL; a row
 * opens the rule's page. Rules are data the server validates and evaluates; nothing here executes one.
 */
export function RulesPanel() {
  const navigate = useNavigate();
  const { canAuthorRules } = useCapabilities();
  const [state, setState] = useUrlParam('state', STATES, '');
  const [kind, setKind] = useUrlParam('kind', KINDS, '');
  const rules = useRules({ state: state || undefined, kind: kind || undefined });
  return (
    <div className="space-y-4" data-testid="rules-panel">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1">
          <Label htmlFor="rule-state-filter">State</Label>
          <NativeSelect id="rule-state-filter" value={state} onChange={(value) => setState(value as RuleState)} placeholder="All states" options={STATE_OPTIONS} />
        </div>
        <div className="w-52 space-y-1">
          <Label htmlFor="rule-kind-filter">Kind</Label>
          <NativeSelect id="rule-kind-filter" value={kind} onChange={(value) => setKind(value as RuleKind)} placeholder="All kinds" options={KIND_OPTIONS} />
        </div>
        <div className="ml-auto">
          {canAuthorRules ? (
            <Button onClick={() => navigate('/master-data/codes-rules/rules/new')} data-testid="rule-new">
              <ActionIcon.add aria-hidden="true" />
              New rule
            </Button>
          ) : (
            <ReadOnlyHint />
          )}
        </div>
      </div>
      <DataTable
        caption="Rules"
        columns={COLUMNS}
        rows={rules.rows}
        getRowKey={(rule) => rule.id}
        pager={rules.pager}
        status={rules.status}
        empty={{ title: 'No rules yet', text: 'Rules become active only when a second person activates them.' }}
        onRowClick={(rule) => navigate(`/master-data/codes-rules/rules/${rule.id}`)}
        rowLabel={(rule) => `Rule ${rule.name}`}
      />
    </div>
  );
}
