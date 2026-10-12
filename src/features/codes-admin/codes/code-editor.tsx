import { useState } from 'react';
import { useChangeCode, useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { changeBodyOf, type CodeForm, formOf, LIBRARIES, OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/code-fields';

export interface CodeEditorProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
}

const OEE_OPTIONS = OEE_COMPONENTS.map((value) => ({ value, label: OEE_COMPONENT_LABELS[value] ?? value }));
const SCHEDULE_OPTIONS = SCHEDULE_CLASSES.map((value) => ({ value, label: SCHEDULE_CLASS_LABELS[value] ?? value }));

interface DefaultsProps {
  form: CodeForm;
  readOnly: boolean;
  set: (key: keyof CodeForm) => (value: string | null) => void;
}

/** Classification defaults of a reason code: OEE component, schedule class and impact code. */
function DefaultsFields({ form, readOnly, set }: DefaultsProps) {
  const impacts = useCodeList('impact-codes', {});
  const impactOptions = impacts.items.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }));
  return (
    <>
      <Field id="code-oee" label="Default OEE component">
        <NativeSelect id="code-oee" testId="code-oee" value={form.oeeComponent} onChange={set('oeeComponent')} placeholder="(none)" options={OEE_OPTIONS} disabled={readOnly} />
      </Field>
      <Field id="code-schedule" label="Default schedule class">
        <NativeSelect id="code-schedule" testId="code-schedule" value={form.scheduleClass} onChange={set('scheduleClass')} placeholder="(none)" options={SCHEDULE_OPTIONS} disabled={readOnly} />
      </Field>
      <Field id="code-impact" label="Default impact code">
        <NativeSelect id="code-impact" value={form.impactCodeId} onChange={set('impactCodeId')} placeholder="(none)" options={impactOptions} disabled={readOnly || impacts.isLoading} />
      </Field>
    </>
  );
}

/** Edits a code: every save is its next version (If-Match; 412 when someone else saved first). */
export function CodeEditor({ library, code }: CodeEditorProps) {
  const { canWriteCodes } = useCapabilities();
  const spec = LIBRARIES[library];
  const [form, setForm] = useState<CodeForm>(() => formOf(code));
  const change = useChangeCode(library);
  const set = (key: keyof CodeForm) => (value: string | null) => setForm((current) => ({ ...current, [key]: value ?? '' }));
  const readOnly = !code.active || !canWriteCodes;
  const save = () => change.submit({ code, body: changeBodyOf(spec, form) }).catch(() => undefined);
  return (
    <div className="space-y-4" data-testid="code-editor">
      {!code.active && <p className="text-sm text-muted-foreground">This code is retired and can no longer be changed.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="code-name" label="Name">
          <Input id="code-name" value={form.name} disabled={readOnly} onChange={(event) => set('name')(event.target.value)} />
        </Field>
        <Field id="code-description" label="Description">
          <Input id="code-description" value={form.description} disabled={readOnly} onChange={(event) => set('description')(event.target.value)} />
        </Field>
        {spec.fields.includes('category') && (
          <Field id="code-category" label="Category">
            <Input id="code-category" value={form.category} disabled={readOnly} onChange={(event) => set('category')(event.target.value)} />
          </Field>
        )}
        {spec.fields.includes('defaults') && <DefaultsFields form={form} readOnly={readOnly} set={set} />}
        {spec.fields.includes('costPerHour') && (
          <Field id="code-cost" label="Cost per hour (plant currency)" hint="Used only where no approved valuation rate exists">
            <DecimalInput id="code-cost" value={form.costPerHour} onChange={(value) => setForm((current) => ({ ...current, costPerHour: value }))} scale={4} disabled={readOnly} />
          </Field>
        )}
        {spec.fields.includes('reportOrder') && (
          <Field id="code-order" label="Order in reports">
            <Input id="code-order" type="number" min={0} value={form.reportOrder} disabled={readOnly} onChange={(event) => set('reportOrder')(event.target.value)} />
          </Field>
        )}
      </div>
      {change.error ? <AdminRefusalAlert error={change.error} /> : null}
      {canWriteCodes && code.active && (
        <Button onClick={save} disabled={change.isPending || form.name.trim() === ''} data-testid="code-save">
          <span>Save as version {code.version + 1}</span>
        </Button>
      )}
    </div>
  );
}
