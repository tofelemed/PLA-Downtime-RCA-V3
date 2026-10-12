import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { INTERPOLATION_LABELS, SIGNAL_TIMEBASE_LABELS, RESET_POLICY_LABELS, SIGNAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { useMappingTargets } from '../hooks/use-mapping-targets';
import type { SignalForm, SignalFormErrors } from '../model/signal-form';

export interface SignalFormFieldsProps {
  form: SignalForm;
  errors: SignalFormErrors;
  timezone: string;
  onChange: (patch: Partial<SignalForm>) => void;
}

const optionsOf = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const TYPES = optionsOf(SIGNAL_TYPE_LABELS);
const TIMEBASES = optionsOf(SIGNAL_TIMEBASE_LABELS);
const INTERPOLATIONS = optionsOf(INTERPOLATION_LABELS);
const RESETS = optionsOf(RESET_POLICY_LABELS);

type TextKey = { [K in keyof SignalForm]: SignalForm[K] extends string ? K : never }[keyof SignalForm];

function TextField({ name, label, hint, props }: { name: TextKey; label: string; hint?: string; props: SignalFormFieldsProps }) {
  const id = `signal-${name}`;
  return (
    <Field id={id} label={label} error={props.errors[name]} hint={hint}>
      <Input id={id} data-testid={id} value={props.form[name]} onChange={(event) => props.onChange({ [name]: event.target.value })} />
    </Field>
  );
}

/** Source, unit and kind of measurement: what every signal needs. */
function BasicFields(props: SignalFormFieldsProps) {
  const { form, errors, onChange } = props;
  const units = useMappingTargets('unit');
  const timed = form.semanticType === 'rate' || form.semanticType === 'counter';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField name="name" label="Name" props={props} />
      <Field id="signal-unit" label="Production unit" error={errors.unitId}>
        <NativeSelect id="signal-unit" testId="signal-unit" value={form.unitId} placeholder={units.isLoading ? 'Loading…' : 'Choose a unit'} options={units.options} onChange={(unitId) => onChange({ unitId })} />
      </Field>
      <TextField name="sourceKey" label="Source stream id" hint="The PI point or attribute WebId, or the MQTT topic." props={props} />
      <TextField name="sourcePath" label="Source path (optional, for reference)" props={props} />
      <Field id="signal-type" label="Kind of measurement">
        <NativeSelect id="signal-type" testId="signal-type" value={form.semanticType} options={TYPES} onChange={(semanticType) => onChange({ semanticType })} />
      </Field>
      <TextField name="canonicalUom" label="Unit of measure (e.g. t, t/h)" hint="Samples in another unit are quarantined." props={props} />
      {timed && (
        <Field id="signal-timebase" label="Time base" error={errors.rateTimebase}>
          <NativeSelect id="signal-timebase" value={form.rateTimebase} options={TIMEBASES} onChange={(rateTimebase) => onChange({ rateTimebase })} />
        </Field>
      )}
    </div>
  );
}

/** Engine settings with sensible defaults, behind a disclosure. */
function AdvancedFields(props: SignalFormFieldsProps) {
  const { form, timezone, onChange } = props;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="signal-interpolation" label="Between samples">
        <NativeSelect id="signal-interpolation" value={form.interpolation} options={INTERPOLATIONS} onChange={(interpolation) => onChange({ interpolation })} />
      </Field>
      <TextField name="maxGapSeconds" label="Longest gap bridged (seconds)" props={props} />
      {form.semanticType === 'counter' && (
        <Field id="signal-reset" label="Counter resets">
          <NativeSelect id="signal-reset" value={form.resetPolicy} options={RESETS} onChange={(resetPolicy) => onChange({ resetPolicy })} />
        </Field>
      )}
      {form.semanticType === 'counter' && <TextField name="rolloverModulus" label="Rollover value (optional)" props={props} />}
      <TextField name="expectedMin" label="Lowest credible value (optional)" props={props} />
      <TextField name="expectedMax" label="Highest credible value (optional)" props={props} />
      <TextField name="cadenceSeconds" label="Expected sample interval, seconds (optional)" props={props} />
      <DateTimeInput label="Valid from (optional)" value={form.effectiveFrom} timeZone={timezone} onChange={(effectiveFrom) => onChange({ effectiveFrom })} />
      <div className="flex items-center gap-2">
        <Checkbox id="signal-uncertain" checked={form.acceptUncertain} onCheckedChange={(checked) => onChange({ acceptUncertain: checked === true })} />
        <Label htmlFor="signal-uncertain">Use uncertain samples (questionable or substituted)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="signal-authority" checked={form.isAuthority} onCheckedChange={(checked) => onChange({ isAuthority: checked === true })} />
        <Label htmlFor="signal-authority">Authoritative source for this unit's output</Label>
      </div>
    </div>
  );
}

export function SignalFormFields(props: SignalFormFieldsProps) {
  return (
    <div className="space-y-6">
      <Section title="Signal" headingLevel={2}>
        <BasicFields {...props} />
      </Section>
      <Section title="Advanced settings" collapsible defaultOpen={false}>
        <AdvancedFields {...props} />
      </Section>
    </div>
  );
}
