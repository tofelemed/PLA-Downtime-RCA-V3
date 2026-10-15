import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProposeUncertaintyBudget, useUncertaintyPreview } from '@/api/v2/queries/uncertainty-budgets';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { budgetBody, emptyBudget, previewBody, validateBudget, type BudgetErrors, type BudgetFormValues } from '../model/budget-form';
import { BudgetResult } from './budget-result';
import { ComponentsEditor } from './components-editor';
import { CorrelationsEditor } from './correlations-editor';

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive" data-testid={`field-error-${id}`}>{error}</p>}
    </div>
  );
}

export interface BudgetFormProps {
  unitId: string;
  timezone: string;
  onDone: () => void;
}

/**
 * SME E4: record the uncertainty budget of one measurement boundary of the unit — its components,
 * optional correlations and coverage factor, with the calibration evidence and the next review. "Compute"
 * asks the server for the combined and expanded uncertainty; the browser never computes them.
 */
export function BudgetForm({ unitId, timezone, onDone }: BudgetFormProps) {
  const [values, setValues] = useState<BudgetFormValues>(() => emptyBudget(new Date().toISOString()));
  const [errors, setErrors] = useState<BudgetErrors>({});
  const preview = useUncertaintyPreview();
  const propose = useProposeUncertaintyBudget();
  const set = <K extends keyof BudgetFormValues>(key: K, value: BudgetFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'components' || key === 'correlations' || key === 'coverageFactor') preview.reset();
  };
  const save = async () => {
    const found = validateBudget(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await propose.submit(budgetBody(values, unitId)).catch(() => null)) onDone();
  };
  return (
    <div className="space-y-4 rounded-md border p-4" data-testid="budget-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="budgetBoundary" label="Measurement boundary" error={errors.boundary}>
          <Input id="budgetBoundary" placeholder="reactor_outlet" maxLength={64} value={values.boundary} onChange={(e) => set('boundary', e.target.value)} />
        </Field>
        <Field id="budgetUom" label="Unit" error={errors.uom}>
          <Input id="budgetUom" maxLength={50} value={values.uom} onChange={(e) => set('uom', e.target.value)} />
        </Field>
        <Field id="budgetK" label="Coverage factor k">
          <DecimalInput id="budgetK" scale={3} value={values.coverageFactor} onChange={(v) => set('coverageFactor', v)} />
        </Field>
      </div>
      <ComponentsEditor rows={values.components} uom={values.uom} onChange={(rows) => set('components', rows)} />
      {errors.components && <p className="text-xs text-destructive">{errors.components}</p>}
      <CorrelationsEditor rows={values.correlations} components={values.components} onChange={(rows) => set('correlations', rows)} />
      {errors.correlations && <p className="text-xs text-destructive">{errors.correlations}</p>}
      <div className="space-y-2">
        <Button type="button" size="sm" variant="outline" disabled={preview.isPending} onClick={() => preview.mutate(previewBody(values))} data-testid="budget-compute">
          Compute
        </Button>
        {preview.error !== null && <FriendlyErrorAlert error={preview.error} title="The budget cannot be computed" />}
        {preview.data && <BudgetResult {...preview.data} uom={values.uom} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="budgetCalibration" label="Calibration evidence" error={errors.calibrationRef}>
          <Input id="budgetCalibration" placeholder="Calibration certificates, test reports" value={values.calibrationRef} onChange={(e) => set('calibrationRef', e.target.value)} />
        </Field>
        <Field id="budgetEvidence" label="Further evidence (optional)">
          <Input id="budgetEvidence" value={values.evidenceRef} onChange={(e) => set('evidenceRef', e.target.value)} />
        </Field>
        <DateTimeInput label="Takes effect" value={values.effectiveFrom} timeZone={timezone} error={errors.effectiveFrom ?? null} onChange={(v) => set('effectiveFrom', v)} />
        <DateTimeInput label="Next review" value={values.reviewDueAt} timeZone={timezone} error={errors.reviewDueAt ?? null} onChange={(v) => set('reviewDueAt', v)} />
        <Field id="budgetNotes" label="Note (optional)">
          <Textarea id="budgetNotes" rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      {propose.error !== null && <FriendlyErrorAlert error={propose.error} title="The budget was not saved" />}
      <div className="flex gap-2">
        <Button onClick={save} disabled={propose.isPending} data-testid="budget-save">
          Propose budget
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
