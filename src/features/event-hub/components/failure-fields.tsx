import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAssetDirectory } from '@/api/v2/queries/assets';
import { useFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import type { FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';
import { dictionaryOptions, equipmentClassOf } from '../model/failure-dictionary-options';
import type { FailureField } from '../model/failure-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

const SEVERITIES: ReadonlyArray<[string, string]> = [
  ['', 'Pending investigation'],
  ['critical', 'Critical — function lost (counts in MTBF)'],
  ['degraded', 'Degraded — function partly lost (counts in MTBF)'],
  ['incipient', 'Incipient — no loss of function yet (not a failure)'],
];

const CODED_FIELDS: ReadonlyArray<[FailureField & EventFormField, string, string]> = [
  ['maintainableItem', 'Maintainable item', 'e.g. mechanical seal'],
  ['failureMode', 'Failure mode', 'e.g. external leakage'],
  ['failureMechanism', 'Mechanism', 'e.g. wear'],
  ['failureCause', 'Cause', 'e.g. inadequate flush'],
  ['detectionMethod', 'Detection method', 'e.g. inspection'],
];

interface FailureForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

export interface FailureDictionaryContext {
  entries: readonly FailureDictionaryEntryView[];
  /** equipment class of the event's asset; null = unknown (every class's codes are offered) */
  assetClass: string | null;
}

function CodedField({ field, label, placeholder, form, dictionary }: {
  field: FailureField & EventFormField;
  label: string;
  placeholder: string;
  form: FailureForm;
  dictionary: FailureDictionaryContext;
}) {
  const { values, errors, setField } = form;
  const options = dictionaryOptions(dictionary.entries, field, { assetClass: dictionary.assetClass, current: values[field] });
  const invalid = Boolean(errors[field]);
  return (
    <div className="space-y-1">
      <Label htmlFor={field}>{label}</Label>
      {options ? (
        <select id={field} className={SELECT_CLASS} value={values[field]} onChange={(e) => setField(field, e.target.value)} aria-invalid={invalid}>
          <option value="">— not known yet —</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input id={field} value={values[field]} placeholder={placeholder} maxLength={field === 'failureMode' ? 255 : 100}
          onChange={(e) => setField(field, e.target.value)} aria-invalid={invalid} />
      )}
      {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
    </div>
  );
}

/**
 * SME D8 / D11: the technical failure description of a stop (ISO 14224-aligned). Severity decides whether
 * it is a functional failure for MTBF. With a plant dictionary each field picks a code of its list (items
 * and modes of the asset's equipment class); without one it stays free text. Every field may stay empty
 * until the investigation knows it. Downtime only; operations reasons stay in the reason code.
 */
export function FailureFieldsView({ form, dictionary }: { form: FailureForm; dictionary: FailureDictionaryContext }) {
  const { values, setField } = form;
  if (values.physicalType !== 'downtime') return null;
  return (
    <fieldset className="space-y-3 rounded-md border p-3 sm:col-span-2" data-testid="failure-fields">
      <legend className="px-1 text-sm font-medium">Failure detail (maintenance)</legend>
      {dictionary.assetClass && <p className="text-xs text-muted-foreground">Equipment class {dictionary.assetClass}</p>}
      <div className="space-y-1">
        <Label htmlFor="failureSeverity">Severity</Label>
        <select id="failureSeverity" className={SELECT_CLASS} value={values.failureSeverity} onChange={(e) => setField('failureSeverity', e.target.value)}>
          {SEVERITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CODED_FIELDS.map(([field, label, placeholder]) => (
          <CodedField key={field} field={field} label={label} placeholder={placeholder} form={form} dictionary={dictionary} />
        ))}
      </div>
    </fieldset>
  );
}

/** The failure fields with the plant's dictionary and the event asset's equipment class. */
export function FailureFields({ form, assetId }: { form: FailureForm; assetId: string | null }) {
  const isDowntime = form.values.physicalType === 'downtime';
  const { entries } = useFailureDictionary(isDowntime);
  const { assets } = useAssetDirectory();
  const assetType = assets.find((a) => a.id === assetId)?.assetType ?? null;
  const dictionary = useMemo(() => ({ entries, assetClass: equipmentClassOf(entries, assetType) }), [entries, assetType]);
  return <FailureFieldsView form={form} dictionary={dictionary} />;
}
