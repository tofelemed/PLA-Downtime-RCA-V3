import { useState } from 'react';
import { useChangeCode, useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { changeBodyOf, CodeForm, formOf, LIBRARIES, OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/code-fields';
import { moveTargets } from '../model/code-tree';

export interface CodeEditorProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
  codes: readonly CodeDetailView[];
}

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/** Edits a code: every save is its next version (If-Match; 412 when someone else saved first). */
export function CodeEditor({ library, code, codes }: CodeEditorProps) {
  const spec = LIBRARIES[library];
  const [form, setForm] = useState<CodeForm>(() => formOf(code));
  const [parentId, setParentId] = useState('');
  const change = useChangeCode(library);
  const impacts = useCodeList('impact-codes', {});
  const set = (key: keyof CodeForm) => (value: string | null) => setForm((current) => ({ ...current, [key]: value ?? '' }));
  const readOnly = !code.active;
  const save = () => change.submit({ code, body: changeBodyOf(spec, form) }).catch(() => undefined);
  const move = () => change.submit({ code, body: { parentId: parentId === 'root' ? null : parentId } }).catch(() => undefined);
  return (
    <div className="space-y-3" data-testid="code-editor">
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
        {spec.fields.includes('defaults') && (
          <>
            <Field id="code-oee" label="Default OEE component">
              <NativeSelect id="code-oee" testId="code-oee" value={form.oeeComponent} onChange={set('oeeComponent')} placeholder="(none)" options={options(OEE_COMPONENTS)} disabled={readOnly} />
            </Field>
            <Field id="code-schedule" label="Default schedule class">
              <NativeSelect id="code-schedule" testId="code-schedule" value={form.scheduleClass} onChange={set('scheduleClass')} placeholder="(none)" options={options(SCHEDULE_CLASSES)} disabled={readOnly} />
            </Field>
            <Field id="code-impact" label="Default impact code">
              <NativeSelect
                id="code-impact"
                value={form.impactCodeId}
                onChange={set('impactCodeId')}
                placeholder="(none)"
                options={impacts.items.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))}
                disabled={readOnly}
              />
            </Field>
          </>
        )}
        {spec.fields.includes('costPerHour') && (
          <Field id="code-cost" label="Cost per hour (tenant currency)">
            <DecimalInput id="code-cost" value={form.costPerHour} onChange={(value) => setForm((current) => ({ ...current, costPerHour: value }))} scale={4} disabled={readOnly} />
          </Field>
        )}
        {spec.fields.includes('reportOrder') && (
          <Field id="code-order" label="Report order">
            <Input id="code-order" type="number" min={0} value={form.reportOrder} disabled={readOnly} onChange={(event) => set('reportOrder')(event.target.value)} />
          </Field>
        )}
      </div>
      <Button onClick={save} disabled={readOnly || change.isPending || form.name.trim() === ''} data-testid="code-save">
        Save as version {code.version + 1}
      </Button>
      {spec.hierarchical && !readOnly && (
        <div className="flex flex-wrap items-end gap-2" data-testid="code-move">
          <Field id="code-move-target" label="Move under">
            <NativeSelect
              id="code-move-target"
              testId="code-move-target"
              value={parentId}
              onChange={setParentId}
              placeholder="Choose a new parent…"
              options={[...(code.parentId ? [{ value: 'root', label: '(top level)' }] : []), ...moveTargets(codes, code.id).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))]}
            />
          </Field>
          <Button variant="outline" onClick={move} disabled={parentId === '' || change.isPending} data-testid="code-move-submit">
            Move
          </Button>
        </div>
      )}
      {change.error ? <AdminRefusalAlert error={change.error} /> : null}
    </div>
  );
}
