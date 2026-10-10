import { useState } from 'react';
import { useRule, useRules, useRulesSchema } from '@/api/v2/queries/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { RuleDetail } from './rule-detail';
import { RuleEditor } from './rule-editor';

/**
 * Declarative admin rules (plan 3.8, NFR02): list, builder, simulation, versions. Rules are data the
 * server validates and evaluates; nothing here executes a rule.
 */
export function RulesPanel({ timezone }: { timezone: string }) {
  const { session } = useAuth();
  const schema = useRulesSchema();
  const rules = useRules();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = useRule(creating ? null : selectedId);
  return (
    <DataState state={dataStateOf(schema)} error={schema.error}>
      {schema.data && (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]" data-testid="rules-panel">
          <section className="space-y-2" aria-label="Rules">
            <Button size="sm" onClick={() => setCreating(true)} data-testid="rule-new">
              New rule
            </Button>
            <DataState state={dataStateOf(rules, { isEmpty: rules.items.length === 0 })} error={rules.error} detail="No rules yet.">
              <ul className="space-y-1">
                {rules.items.map((rule) => (
                  <li key={rule.id}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1 text-left text-sm ${rule.id === selectedId && !creating ? 'bg-muted' : ''}`}
                      onClick={() => {
                        setCreating(false);
                        setSelectedId(rule.id);
                      }}
                      data-testid="rule-item"
                      data-name={rule.name}
                      data-state={rule.state}
                    >
                      <span className="block truncate">{rule.name}</span>
                      <span className="flex gap-1 text-xs text-muted-foreground">
                        <Badge variant="outline">{rule.state}</Badge>
                        {rule.activeVersion !== null && <span>v{rule.activeVersion}</span>}
                        {rule.draft && <span>· draft</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </DataState>
          </section>
          {creating ? (
            <section className="rounded-md border p-3" aria-label="New rule">
              <h2 className="mb-2 text-lg font-semibold">New rule (draft)</h2>
              <RuleEditor
                schema={schema.data}
                rule={null}
                onSaved={(rule) => {
                  setCreating(false);
                  setSelectedId(rule.id);
                }}
              />
            </section>
          ) : selected.data ? (
            <RuleDetail rule={selected.data} schema={schema.data} timezone={timezone} currentUserId={session?.user.id ?? null} />
          ) : selectedId ? (
            <DataState state={selected.isError ? 'error' : 'loading'} error={selected.error} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a rule or create one. Rules become active only when a second approver activates them.</p>
          )}
        </div>
      )}
    </DataState>
  );
}
