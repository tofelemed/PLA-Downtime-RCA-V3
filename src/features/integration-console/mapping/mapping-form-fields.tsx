import type { ConnectionView } from '@/api/v2/types/integrations';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { MAPPING_TARGET_LABELS, MATCH_KIND_LABELS } from '@/features/ux-kit/labels';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { useMappingTargets } from '../hooks/use-mapping-targets';
import { SOURCE_SYSTEM_OPTIONS, type MappingForm, type MappingFormErrors } from '../model/mapping-form';

export interface MappingFormFieldsProps {
  form: MappingForm;
  errors: MappingFormErrors;
  connections: readonly ConnectionView[];
  timezone: string;
  onChange: (patch: Partial<MappingForm>) => void;
}

const optionsOf = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const MATCH_OPTIONS = optionsOf(MATCH_KIND_LABELS);
const TARGET_OPTIONS = optionsOf(MAPPING_TARGET_LABELS);
const MATCH_HINT = 'Paths and patterns use backslash or slash as separators and ignore case; * matches any run, ? one character.';

/** What a rule matches: kind, value, connection (or every connection of a kind) and precedence. */
function SourceFields({ form, errors, connections, onChange }: Omit<MappingFormFieldsProps, 'timezone'>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="mapping-kind" label="Match">
        <NativeSelect id="mapping-kind" testId="mapping-kind" value={form.matchKind} options={MATCH_OPTIONS} onChange={(value) => onChange({ matchKind: value as MappingForm['matchKind'] })} />
      </Field>
      <Field id="mapping-value" label="Source value" error={errors.matchValue} hint={MATCH_HINT}>
        <Input id="mapping-value" data-testid="mapping-value" value={form.matchValue} maxLength={1000} onChange={(event) => onChange({ matchValue: event.target.value })} />
      </Field>
      <Field id="mapping-connection" label="Connection">
        <NativeSelect
          id="mapping-connection"
          testId="mapping-connection"
          value={form.connectionId}
          placeholder="Every connection"
          options={connections.map((connection) => ({ value: connection.id, label: connection.displayName }))}
          onChange={(connectionId) => onChange({ connectionId })}
        />
      </Field>
      {form.connectionId === '' && (
        <Field id="mapping-system" label="Applies to">
          <NativeSelect id="mapping-system" value={form.sourceSystem} options={SOURCE_SYSTEM_OPTIONS} onChange={(sourceSystem) => onChange({ sourceSystem })} />
        </Field>
      )}
      <Field id="mapping-precedence" label="Precedence (higher wins among patterns)" error={errors.precedence}>
        <Input id="mapping-precedence" type="number" min={-1000} max={1000} value={form.precedence} onChange={(event) => onChange({ precedence: event.target.value })} />
      </Field>
    </div>
  );
}

/** Where it points (unit or asset), when it applies, whether it is active, and why. */
function TargetFields({ form, errors, timezone, onChange }: Omit<MappingFormFieldsProps, 'connections'>) {
  const targets = useMappingTargets(form.targetType);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="mapping-target-type" label="Maps to">
        <NativeSelect id="mapping-target-type" value={form.targetType} options={TARGET_OPTIONS} onChange={(value) => onChange({ targetType: value as MappingForm['targetType'], targetId: '' })} />
      </Field>
      <Field id="mapping-target" label={form.targetType === 'unit' ? 'Unit' : 'Asset'} error={errors.targetId}>
        <NativeSelect id="mapping-target" testId="mapping-target" value={form.targetId} placeholder={targets.isLoading ? 'Loading…' : 'Choose'} options={targets.options} onChange={(targetId) => onChange({ targetId })} />
      </Field>
      <DateTimeInput label="Valid from (optional)" value={form.effectiveFrom} timeZone={timezone} onChange={(effectiveFrom) => onChange({ effectiveFrom })} />
      <DateTimeInput label="Valid until (optional)" value={form.effectiveTo} timeZone={timezone} error={errors.effectiveTo} onChange={(effectiveTo) => onChange({ effectiveTo })} />
      <div className="flex items-center gap-2">
        <Checkbox id="mapping-active" checked={form.isActive} onCheckedChange={(checked) => onChange({ isActive: checked === true })} />
        <Label htmlFor="mapping-active">Active</Label>
      </div>
      <div className="sm:col-span-2">
        <Field id="mapping-description" label="Description (optional)">
          <Textarea id="mapping-description" value={form.description} maxLength={2000} onChange={(event) => onChange({ description: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function MappingFormFields(props: MappingFormFieldsProps) {
  return (
    <div className="space-y-6">
      <SourceFields {...props} />
      <TargetFields {...props} />
    </div>
  );
}
