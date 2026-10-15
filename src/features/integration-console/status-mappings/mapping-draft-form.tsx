import { useState } from 'react';
import { useCreateStatusMapping } from '@/api/v2/queries/status-mappings';
import type { SourceStatusEntry, SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { initialMappingForm, mappingCreateBody, validateMappingForm, type StatusMappingFieldErrors, type StatusMappingFormValues } from './status-mapping-form';

export interface MappingDraftFormProps {
  /** the source's newest version for a new version of it, null for a new source */
  basis: SourceStatusMappingView | null;
  timezone: string;
  onDone: () => void;
}

function StatusRows({ rows, onChange }: { rows: SourceStatusEntry[]; onChange: (rows: SourceStatusEntry[]) => void }) {
  const set = (index: number, next: Partial<SourceStatusEntry>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));
  return (
    <div className="space-y-2" data-testid="mapping-status-rows">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`Source status ${index + 1}`} className="w-48" maxLength={64} value={row.status} onChange={(e) => set(index, { status: e.target.value })} data-testid="mapping-status" />
          <label className="flex items-center gap-1 text-sm">
            <Checkbox checked={row.released} onCheckedChange={(checked) => set(index, { released: checked === true })} data-testid="mapping-released" />
            Released (authorised final record)
          </label>
          <Button variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, i) => i !== index))} disabled={rows.length === 1}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, { status: '', released: false }])} data-testid="mapping-add-status">
        Add status
      </Button>
    </div>
  );
}

/**
 * Drafts a new mapping version (SME R13): which source statuses are released, from when. It applies only
 * after the source owner — someone other than its author — approves it; the server decides roles and overlaps.
 */
export function MappingDraftForm({ basis, timezone, onDone }: MappingDraftFormProps) {
  const create = useCreateStatusMapping();
  const [values, setValues] = useState<StatusMappingFormValues>(() => initialMappingForm(basis));
  const [errors, setErrors] = useState<StatusMappingFieldErrors>({});
  const set = <K extends keyof StatusMappingFormValues>(key: K, value: StatusMappingFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const save = () => {
    const found = validateMappingForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.submit(mappingCreateBody(values)).then(onDone, () => undefined);
  };
  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="mapping-draft-form">
      <Field id="mapping-source" label="Source system" error={errors.sourceSystem} hint="`import` = API and file imports of production reports">
        <Input id="mapping-source" value={values.sourceSystem} disabled={Boolean(basis)} onChange={(e) => set('sourceSystem', e.target.value)} data-testid="mapping-source" />
      </Field>
      <DateTimeInput label="Effective from" value={values.effectiveFrom} timeZone={timezone} error={errors.effectiveFrom ?? null} onChange={(iso) => set('effectiveFrom', iso)} />
      <Field id="mapping-statuses" label="Status rules" error={errors.statuses}>
        <StatusRows rows={values.statuses} onChange={(rows) => set('statuses', rows)} />
      </Field>
      <Field id="mapping-notes" label="Notes (optional)" hint="The source workflow documentation this follows">
        <Textarea id="mapping-notes" rows={2} maxLength={2000} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <ConsoleRefusal error={create.error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending} data-testid="mapping-save">
          Save draft
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
