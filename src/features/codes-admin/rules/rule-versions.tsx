import { useRuleVersions } from '@/api/v2/queries/rules';
import type { RulesSchemaView, RuleVersionView, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { usePlantDates } from '../hooks/use-plant-dates';
import { useRuleValueText } from '../hooks/use-rule-value-text';
import { diffDefinitions, type ValueText } from '../model/rule-describe';
import { RuleRollbackAction } from './rule-rollback-action';

export interface RuleVersionsProps {
  rule: RuleView;
  schema: RulesSchemaView;
}

const MARK = { added: '+', removed: '−', same: ' ' } as const;
const TONE = { added: 'text-green-700 dark:text-green-400', removed: 'text-destructive line-through', same: 'text-muted-foreground' } as const;

function DefinitionDiff({ rows, index, schema, valueText }: { rows: readonly RuleVersionView[]; index: number; schema: RulesSchemaView; valueText: ValueText }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-xs" data-testid="rule-diff">
      {diffDefinitions(rows[index + 1]?.definition ?? null, rows[index].definition, schema, valueText).map((line) => (
        <span key={`${line.change}:${line.text}`} className={`block ${TONE[line.change]}`} data-change={line.change}>
          {MARK[line.change]} {line.text}
        </span>
      ))}
    </pre>
  );
}

/** Approved versions newest first, 20 per page, each diffed against the one before; rollback adds a version. */
export function RuleVersions({ rule, schema }: RuleVersionsProps) {
  const { canApproveRules } = useCapabilities();
  const versions = useRuleVersions(rule.id);
  const dates = usePlantDates();
  const valueText = useRuleValueText(schema);
  const rows = versions.data ?? [];
  const indexOf = (entry: RuleVersionView) => rows.findIndex((row) => row.version === entry.version);
  const columns: Array<DataTableColumn<RuleVersionView>> = [
    {
      id: 'version',
      header: 'Version',
      nowrap: true,
      cell: (entry) => (
        <span data-testid="rule-version" data-version={entry.version} data-current={entry.current} data-origin={entry.origin}>
          Version {entry.version}
          {entry.origin === 'rollback' && entry.restoredVersion !== null ? ` (restores ${entry.restoredVersion})` : ''}
        </span>
      ),
    },
    { id: 'from', header: 'In force from', nowrap: true, cell: (entry) => dates.dateTime(entry.effectiveFrom) },
    { id: 'reason', header: 'Reason', cell: (entry) => entry.reason ?? '—' },
    { id: 'changes', header: 'Definition', cell: (entry) => <DefinitionDiff rows={rows} index={indexOf(entry)} schema={schema} valueText={valueText} /> },
    {
      id: 'action',
      header: 'Status',
      cell: (entry) =>
        entry.current ? (
          <Badge variant="outline">In force</Badge>
        ) : rule.state !== 'retired' && canApproveRules ? (
          <RuleRollbackAction rule={rule} version={entry.version} />
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div data-testid="rule-versions">
      <DataTable
        caption={`Versions of ${rule.name}`}
        columns={columns}
        rows={rows}
        getRowKey={(entry) => String(entry.version)}
        status={{ isLoading: versions.isLoading, isError: versions.isError, error: versions.error, onRetry: () => void versions.refetch() }}
        empty={{ title: 'No approved version yet', text: 'A version appears when a draft is activated.' }}
      />
    </div>
  );
}
