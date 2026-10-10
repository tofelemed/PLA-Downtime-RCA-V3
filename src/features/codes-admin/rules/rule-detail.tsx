import { useActivateRule, useRetireRule } from '@/api/v2/queries/rules';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { RuleEditor } from './rule-editor';
import { RuleVersions } from './rule-versions';
import { SimulationPanel } from './simulation-panel';

export interface RuleDetailProps {
  rule: RuleView;
  schema: RulesSchemaView;
  timezone: string;
  currentUserId: string | null;
}

/**
 * One rule: builder for the draft, simulation, version timeline with rollback. Activation is a second
 * person's act (the server answers 403 SEPARATION_OF_DUTIES to the draft author).
 */
export function RuleDetail({ rule, schema, timezone, currentUserId }: RuleDetailProps) {
  const activate = useActivateRule();
  const retire = useRetireRule();
  const ownDraft = Boolean(rule.draft && rule.draft.authorId === currentUserId);
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid="rule-detail" data-state={rule.state} data-active-version={rule.activeVersion ?? ''} data-has-draft={Boolean(rule.draft)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{rule.name}</h2>
          <p className="text-xs text-muted-foreground">
            {schema.kinds.find((entry) => entry.kind === rule.kind)?.label ?? rule.kind} · {rule.appliedBy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={rule.state === 'active' ? 'outline' : 'secondary'}>{rule.state}</Badge>
          {rule.activeVersion !== null && <Badge variant="outline">v{rule.activeVersion} in force</Badge>}
          {rule.draft && <Badge variant="secondary">draft pending{ownDraft ? ' (yours)' : ''}</Badge>}
          {rule.draft && rule.state !== 'retired' && (
            <Button size="sm" onClick={() => activate.submit({ rule }).catch(() => undefined)} disabled={activate.isPending} data-testid="rule-activate" title={ownDraft ? 'Another approver must activate your draft' : undefined}>
              Activate draft
            </Button>
          )}
          {rule.state !== 'retired' && (
            <Button size="sm" variant="destructive" onClick={() => retire.submit({ rule }).catch(() => undefined)} disabled={retire.isPending} data-testid="rule-retire">
              Retire
            </Button>
          )}
        </div>
      </header>
      {activate.error ? <AdminRefusalAlert error={activate.error} /> : null}
      {retire.error ? <AdminRefusalAlert error={retire.error} /> : null}
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="simulation" data-testid="tab-simulation">
            Simulation
          </TabsTrigger>
          <TabsTrigger value="versions" data-testid="tab-rule-versions">
            Versions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="builder">
          <RuleEditor key={`${rule.id}:${rule.rowVersion}`} schema={schema} rule={rule} onSaved={() => undefined} />
        </TabsContent>
        <TabsContent value="simulation">
          <SimulationPanel key={`${rule.id}:${rule.rowVersion}`} rule={rule} timezone={timezone} />
        </TabsContent>
        <TabsContent value="versions">
          <RuleVersions rule={rule} schema={schema} timezone={timezone} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
