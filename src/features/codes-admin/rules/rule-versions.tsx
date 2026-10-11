import { useRollbackRule, useRuleVersions } from '@/api/v2/queries/rules';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { diffDefinitions } from '../model/rule-describe';

export interface RuleVersionsProps {
  rule: RuleView;
  schema: RulesSchemaView;
  timezone: string;
}

const MARK = { added: '+', removed: '−', same: ' ' } as const;
const TONE = { added: 'text-green-700 dark:text-green-400', removed: 'text-destructive line-through', same: 'text-muted-foreground' } as const;

/** Approved versions newest first, each diffed against the one before; rollback adds a new version. */
export function RuleVersions({ rule, schema, timezone }: RuleVersionsProps) {
  const { canApproveRules } = useCapabilities();
  const versions = useRuleVersions(rule.id);
  const rollback = useRollbackRule();
  const rows = versions.data ?? [];
  return (
    <div className="space-y-2" data-testid="rule-versions">
      {rollback.error ? <AdminRefusalAlert error={rollback.error} /> : null}
      <DataState state={dataStateOf(versions, { isEmpty: rows.length === 0 })} error={versions.error} detail="Not activated yet: no approved version.">
        <ol className="space-y-2">
          {rows.map((entry, index) => (
            <li key={entry.version} className="rounded border p-2 text-sm" data-testid="rule-version" data-version={entry.version} data-current={entry.current} data-origin={entry.origin}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  Version {entry.version} · {entry.origin === 'rollback' ? `rollback to v${entry.restoredVersion}` : 'activation'} ·{' '}
                  <PlantTime iso={entry.effectiveFrom} tz={timezone} withDate />
                  {entry.reason && ` · ${entry.reason}`}
                </p>
                {entry.current ? (
                  <Badge variant="outline">in force</Badge>
                ) : (
                  rule.state !== 'retired' &&
                  canApproveRules && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rollback.isPending}
                      onClick={() => rollback.submit({ rule, toVersion: entry.version }).catch(() => undefined)}
                      data-testid="rule-rollback"
                    >
                      Roll back to this version
                    </Button>
                  )
                )}
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-xs" data-testid="rule-diff">
                {diffDefinitions(rows[index + 1]?.definition ?? null, entry.definition, schema).map((line) => (
                  <span key={`${line.change}:${line.text}`} className={`block ${TONE[line.change]}`} data-change={line.change}>
                    {MARK[line.change]} {line.text}
                  </span>
                ))}
              </pre>
            </li>
          ))}
        </ol>
      </DataState>
    </div>
  );
}
