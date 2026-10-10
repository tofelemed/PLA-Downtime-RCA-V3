import { useState } from 'react';
import { useCodeList, useCodeMappingRules, useCreateCodeMappingRule } from '@/api/v2/queries/codes-admin';
import type { CodeMappingRuleKind } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/code-fields';

const KINDS: ReadonlyArray<{ value: Exclude<CodeMappingRuleKind, 'impact_to_valuation'>; label: string }> = [
  { value: 'reason_to_schedule_class', label: 'Reason → schedule class' },
  { value: 'reason_to_oee', label: 'Reason → OEE component' },
  { value: 'reason_to_impact', label: 'Reason → impact code' },
];

/**
 * Versioned default mappings of a reason code (spec §3.2): every save is the next version of the
 * (kind, reason) rule; older versions stay unchanged, so past events keep their basis (T18).
 */
export function MappingRulesPanel() {
  const { timezone } = usePlantTimezone();
  const reasons = useCodeList('reason-codes', {});
  const impacts = useCodeList('impact-codes', {});
  const [reasonId, setReasonId] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('reason_to_schedule_class');
  const [target, setTarget] = useState('');
  const rules = useCodeMappingRules(reasonId || null);
  const create = useCreateCodeMappingRule();
  const targets =
    kind === 'reason_to_impact'
      ? impacts.items.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))
      : (kind === 'reason_to_oee' ? OEE_COMPONENTS : SCHEDULE_CLASSES).map((value) => ({ value, label: value }));
  const save = () =>
    create
      .submit(kind === 'reason_to_impact' ? { ruleKind: kind, sourceCodeId: reasonId, targetCodeId: target } : { ruleKind: kind, sourceCodeId: reasonId, targetValue: target })
      .then(() => setTarget(''))
      .catch(() => undefined);
  const sorted = [...rules.items].sort((a, b) => a.ruleKind.localeCompare(b.ruleKind) || b.version - a.version);
  const label = (id: string | null) => impacts.items.find((entry) => entry.id === id)?.code ?? id;
  return (
    <div className="space-y-3" data-testid="mapping-rules">
      <Field id="mr-reason" label="Reason code">
        <NativeSelect id="mr-reason" testId="mr-reason" value={reasonId} onChange={setReasonId} placeholder="Choose a reason code…" options={reasons.items.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))} />
      </Field>
      {reasonId && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Field id="mr-kind" label="Mapping">
              <NativeSelect id="mr-kind" testId="mr-kind" value={kind} onChange={(value) => { setKind(value as typeof kind); setTarget(''); }} options={KINDS} />
            </Field>
            <Field id="mr-target" label="Default">
              <NativeSelect id="mr-target" testId="mr-target" value={target} onChange={setTarget} placeholder="Choose…" options={targets} />
            </Field>
            <Button onClick={save} disabled={!target || create.isPending} data-testid="mr-save">
              Save as next version
            </Button>
          </div>
          {create.error ? <AdminRefusalAlert error={create.error} /> : null}
          <DataState state={dataStateOf(rules, { isEmpty: sorted.length === 0 })} error={rules.error} detail="No mapping rules yet: the code's own defaults apply.">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Mapping</th>
                  <th>Version</th>
                  <th>Default</th>
                  <th>Effective from</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((rule) => (
                  <tr key={rule.id} data-testid="mr-row" data-kind={rule.ruleKind} data-version={rule.version} data-target={rule.targetValue ?? rule.targetCodeId ?? ''}>
                    <td>{KINDS.find((entry) => entry.value === rule.ruleKind)?.label ?? rule.ruleKind}</td>
                    <td>v{rule.version}</td>
                    <td>{rule.targetValue ?? label(rule.targetCodeId)}</td>
                    <td>
                      <PlantTime iso={rule.effectiveFrom} tz={timezone} withDate />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </>
      )}
    </div>
  );
}
