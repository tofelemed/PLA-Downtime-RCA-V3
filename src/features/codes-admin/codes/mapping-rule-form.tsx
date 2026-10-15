import { useState } from 'react';
import { useCodeList, useCreateCodeMappingRule } from '@/api/v2/queries/codes-admin';
import type { CodeMappingRuleKind } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { CODE_MAPPING_RULE_KIND_LABELS } from '@/features/ux-kit/labels';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/code-fields';

type ReasonMappingKind = Exclude<CodeMappingRuleKind, 'impact_to_valuation'>;

const REASON_MAPPING_KINDS: readonly ReasonMappingKind[] = ['reason_to_schedule_class', 'reason_to_oee', 'reason_to_impact'];

const KIND_OPTIONS = REASON_MAPPING_KINDS.map((value) => ({ value, label: CODE_MAPPING_RULE_KIND_LABELS[value] }));

function useTargets(kind: ReasonMappingKind) {
  const impacts = useCodeList('impact-codes', {});
  if (kind === 'reason_to_impact') return impacts.items.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }));
  if (kind === 'reason_to_oee') return OEE_COMPONENTS.map((value) => ({ value, label: OEE_COMPONENT_LABELS[value] ?? value }));
  return SCHEDULE_CLASSES.map((value) => ({ value, label: SCHEDULE_CLASS_LABELS[value] ?? value }));
}

/** A new version of one default mapping of the reason code (older versions stay unchanged). */
export function MappingRuleForm({ reasonId }: { reasonId: string }) {
  const create = useCreateCodeMappingRule();
  const [kind, setKind] = useState<ReasonMappingKind>('reason_to_schedule_class');
  const [target, setTarget] = useState('');
  const targets = useTargets(kind);
  const save = () =>
    create
      .submit(kind === 'reason_to_impact' ? { ruleKind: kind, sourceCodeId: reasonId, targetCodeId: target } : { ruleKind: kind, sourceCodeId: reasonId, targetValue: target })
      .then(() => setTarget((current) => current === target ? '' : current))
      .catch(() => undefined);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Field id="mr-kind" label="Mapping">
            <NativeSelect id="mr-kind" testId="mr-kind" value={kind} onChange={(value) => { setKind(value as ReasonMappingKind); setTarget(''); }} options={KIND_OPTIONS} />
          </Field>
        </div>
        <div className="w-64">
          <Field id="mr-target" label="Default">
            <NativeSelect id="mr-target" testId="mr-target" value={target} onChange={setTarget} placeholder="Choose…" options={targets} />
          </Field>
        </div>
        <Button onClick={save} disabled={!target || create.isPending} data-testid="mr-save">
          Save as next version
        </Button>
      </div>
      {create.error ? <AdminRefusalAlert error={create.error} /> : null}
    </div>
  );
}
