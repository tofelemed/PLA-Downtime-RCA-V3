import { useState } from 'react';
import { useDraftSourceAuthorityVersion, useSourceAuthorityInForce } from '@/api/v2/queries/source-authority';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE, type BackdateErrors } from '@/features/policy-backdate/backdate-model';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { emptyEntry, FALLBACK_CONDITIONS, hierarchyDraftBody, initialHierarchyForm, validateHierarchyForm, type HierarchyFieldErrors, type HierarchyFormValues } from './hierarchy-form';
import { HierarchyEntryFields } from './hierarchy-entry-fields';

const SCOPE_OPTIONS = [
  { value: 'unit', label: 'This unit' },
  { value: 'plant', label: 'The whole plant' },
];

function Conditions({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (condition: string, on: boolean) => onChange(on ? [...value, condition] : value.filter((c) => c !== condition));
  return (
    <div className="flex flex-wrap gap-3" data-testid="authority-conditions">
      {FALLBACK_CONDITIONS.map((c) => (
        <label key={c.value} className="flex items-center gap-1 text-sm">
          <Checkbox checked={value.includes(c.value)} onCheckedChange={(on) => toggle(c.value, on === true)} />
          {c.label}
        </label>
      ))}
    </div>
  );
}

function EditorForm({ initial, unitId, onDone }: { initial: HierarchyFormValues; unitId: string; onDone: () => void }) {
  const draft = useDraftSourceAuthorityVersion();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<HierarchyFieldErrors>({});
  const [backdate, setBackdate] = useState(EMPTY_BACKDATE);
  const [backdateProblems, setBackdateProblems] = useState<BackdateErrors>({});
  const set = <K extends keyof HierarchyFormValues>(key: K, value: HierarchyFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const entries = values.entries;
  const move = (from: number, to: number) => {
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set('entries', next);
  };
  const save = () => {
    const found = validateHierarchyForm(values);
    const backdateFound = backdateErrors(backdate);
    setErrors(found);
    setBackdateProblems(backdateFound);
    if (Object.keys(found).length > 0 || Object.keys(backdateFound).length > 0) return;
    draft.submit({ ...hierarchyDraftBody(values, unitId), ...backdateBodyOf(backdate) }).then(onDone, () => undefined);
  };
  return (
    <div className="space-y-3" data-testid="authority-editor">
      <Field id="authority-boundary" label="Measurement boundary" error={errors.boundary} hint="The slice boundary the ranked sources stand for, e.g. reactor_outlet">
        <Input id="authority-boundary" value={values.boundary} onChange={(e) => set('boundary', e.target.value)} data-testid="authority-boundary" />
      </Field>
      <Field id="authority-conditions" label="A lower rank replaces a better one when that one is">
        <Conditions value={values.conditions} onChange={(next) => set('conditions', next)} />
      </Field>
      <Field id="authority-entries" label="Sources, best first" error={errors.entries}>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <HierarchyEntryFields
              key={index}
              index={index}
              count={entries.length}
              entry={entry}
              error={errors.entry?.[index]}
              onChange={(next) => set('entries', entries.map((e, i) => (i === index ? next : e)))}
              onMove={(to) => move(index, to)}
              onRemove={() => set('entries', entries.filter((_, i) => i !== index))}
            />
          ))}
          <Button size="sm" variant="outline" disabled={entries.length >= 10} onClick={() => set('entries', [...entries, emptyEntry(values.boundary)])} data-testid="authority-add-entry">
            Add source
          </Button>
        </div>
      </Field>
      <Field id="authority-notes" label="Notes (optional)">
        <Textarea id="authority-notes" rows={2} maxLength={2000} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <CommissioningBackdateFields idPrefix="authority" value={backdate} onChange={setBackdate} errors={backdateProblems} takesEffect="approval" />
      <ConsoleRefusal error={draft.error} />
      <BackdateOverlapList error={draft.error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={draft.isPending} data-testid="authority-save">
          Save draft
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Drafts a new source authority version for the unit or the whole plant, starting from the version in force
 * for that scope. It applies only once production accounting — an independent approver, or the author acting as SuperAdmin — approves it;
 * the server checks ranks, classes, boundaries and lags and its refusal is shown as it is.
 */
export function HierarchyEditor({ unitId, onDone }: { unitId: string; onDone: () => void }) {
  const [scope, setScope] = useState<'unit' | 'plant'>('unit');
  const base = useSourceAuthorityInForce(scope === 'unit' ? unitId : null);
  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="authority-draft-form">
      <Field id="authority-scope" label="Applies to">
        <NativeSelect id="authority-scope" testId="authority-scope" value={scope} onChange={(v) => setScope(v === 'plant' ? 'plant' : 'unit')} options={SCOPE_OPTIONS} />
      </Field>
      <DataState state={dataStateOf(base)} error={base.error} onRetry={() => void base.refetch()}>
        {base.data && <EditorForm key={`${scope}-${base.data.policyId}`} initial={initialHierarchyForm(base.data.policy, scope)} unitId={unitId} onDone={onDone} />}
      </DataState>
    </div>
  );
}
