import { useState } from 'react';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useSimulateRule } from '@/api/v2/queries/rules';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { SimulationResult } from './simulation-result';

const PRESETS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
];

/**
 * Simulation step (NFR02): the server runs the draft (or a chosen version) over stored events of the
 * window and records the run; the panel shows its before/after counts and sample diffs as returned.
 */
export function SimulationPanel({ rule, schema }: { rule: RuleView; schema: RulesSchemaView }) {
  const { canAuthorRules } = useCapabilities();
  const units = useUnits();
  const simulate = useSimulateRule();
  const [hours, setHours] = useState('168');
  const [unitId, setUnitId] = useState('');
  const [version, setVersion] = useState(rule.draft ? 'draft' : String(rule.activeVersion ?? ''));
  const versions = [
    ...(rule.draft ? [{ value: 'draft', label: 'Draft (not active)' }] : []),
    ...Array.from({ length: rule.activeVersion ?? 0 }, (_, index) => {
      const number = (rule.activeVersion ?? 0) - index;
      return { value: String(number), label: `Version ${number}${number === rule.activeVersion ? ' (in force)' : ''}` };
    }),
  ];
  const run = () => {
    const now = Date.now();
    simulate
      .submit({
        id: rule.id,
        body: {
          from: new Date(now - Number(hours) * 3_600_000).toISOString(),
          to: new Date(now).toISOString(),
          ...(unitId ? { unitIds: [unitId] } : {}),
          ...(version && version !== 'draft' ? { version: Number(version) } : {}),
        },
      })
      .catch(() => undefined);
  };
  if (!canAuthorRules) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="simulation-panel">
        Simulations are run by rule authors (master-data admins and manager approvers).
      </p>
    );
  }
  return (
    <div className="space-y-3" data-testid="simulation-panel">
      <div className="flex flex-wrap items-end gap-2">
        <Field id="sim-window" label="Window">
          <NativeSelect id="sim-window" testId="sim-window" value={hours} onChange={setHours} options={PRESETS} />
        </Field>
        <Field id="sim-unit" label="Unit">
          <NativeSelect id="sim-unit" testId="sim-unit" value={unitId} onChange={setUnitId} placeholder="All units in scope" options={flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name }))} />
        </Field>
        <Field id="sim-version" label="Definition">
          <NativeSelect id="sim-version" testId="sim-version" value={version} onChange={setVersion} options={versions} />
        </Field>
        <Button className="h-9" onClick={run} disabled={simulate.isPending || versions.length === 0} data-testid="sim-run">
          Run simulation
        </Button>
      </div>
      {simulate.error ? <AdminRefusalAlert error={simulate.error} /> : null}
      {simulate.data && <SimulationResult result={simulate.data} schema={schema} />}
    </div>
  );
}
