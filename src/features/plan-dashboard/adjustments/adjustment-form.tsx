import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PeriodDetailView } from '@/api/v2/types/periods';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { FormField } from '@/features/ux-kit/form-field';
import { useProductNames } from '@/features/ux-kit/labels';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useProposeAdjustment } from '../hooks/use-adjustment-commands';
import { ADJUSTMENT_BASIS_LABELS, ADJUSTMENT_KIND_LABELS } from '../model/actuals-labels';
import { adjustmentBody, emptyAdjustment, validateAdjustment, type AdjustmentErrors, type AdjustmentFormValues } from '../model/adjustment-form';

export interface AdjustmentFormProps {
  period: PeriodDetailView;
  timezone: string;
  backTo: string;
  onSaved: () => void;
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/** Propose a correction of one product's actuals in the period: what, how much (signed), basis, reason, evidence. */
export function AdjustmentForm({ period, timezone, backTo, onSaved }: AdjustmentFormProps) {
  const products = useProductNames();
  const [start] = useState<AdjustmentFormValues>(() => emptyAdjustment(period.slices[0]?.id ?? ''));
  const [values, setValues] = useState<AdjustmentFormValues>(start);
  const [errors, setErrors] = useState<AdjustmentErrors>({});
  const [quantityText, setQuantityText] = useState('');
  const propose = useProposeAdjustment();
  useUnsavedChangesGuard(hasUnsavedChanges({ ...values, quantityText }, { ...start, quantityText: '' }, [propose.isPending]));
  const set = <K extends keyof AdjustmentFormValues>(key: K, value: AdjustmentFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const uom = period.slices.find((s) => s.id === values.sliceId)?.quantityUom ?? null;
  const save = async () => {
    const found = validateAdjustment(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await propose.submit(adjustmentBody(values)).catch(() => null)) onSaved();
  };
  return (
    <div className="space-y-4" data-testid="adjustment-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="adjSlice" label="Product" required error={errors.sliceId}>
          <select id="adjSlice" className={SELECT} value={values.sliceId} onChange={(e) => set('sliceId', e.target.value)}>
            {period.slices.map((s) => (
              <option key={s.id} value={s.id}>{`${products.nameOf(s.productId)}${s.quantityUom ? ` (${s.quantityUom})` : ''}`}</option>
            ))}
          </select>
        </FormField>
        <FormField id="adjKind" label="Corrects" required>
          <select id="adjKind" className={SELECT} value={values.kind} onChange={(e) => set('kind', e.target.value as AdjustmentFormValues['kind'])}>
            {Object.entries(ADJUSTMENT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>
        <FormField id="adjQuantity" label={`Change${uom ? ` (${uom})` : ''}, e.g. -5`} required error={errors.quantity}>
          <DecimalInput id="adjQuantity" value={values.quantity} allowNegative onChange={(v) => set('quantity', v)} onTextChange={setQuantityText} />
        </FormField>
        <FormField id="adjBasis" label="Basis" required>
          <select id="adjBasis" className={SELECT} value={values.basis} onChange={(e) => set('basis', e.target.value as AdjustmentFormValues['basis'])}>
            {Object.entries(ADJUSTMENT_BASIS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>
        <FormField id="adjEvidence" label="Evidence (ticket, report, sample number)" required error={errors.evidenceRef}>
          <Input id="adjEvidence" value={values.evidenceRef} onChange={(e) => set('evidenceRef', e.target.value)} />
        </FormField>
        <FormField id="adjReason" label="Reason" required error={errors.reason}>
          <Textarea id="adjReason" rows={2} value={values.reason} onChange={(e) => set('reason', e.target.value)} />
        </FormField>
        <DateTimeInput label="Measured from (optional)" value={values.windowFrom} timeZone={timezone} onChange={(v) => set('windowFrom', v)} />
        <DateTimeInput label="Measured to (optional)" value={values.windowTo} timeZone={timezone} error={errors.windowTo ?? null} onChange={(v) => set('windowTo', v)} />
      </div>
      {propose.error !== null && <FriendlyErrorAlert error={propose.error} title="The adjustment was not saved" />}
      <div className="flex gap-2">
        <Button onClick={save} disabled={propose.isPending} data-testid="adjustment-save">
          Propose adjustment
        </Button>
        <Button asChild variant="outline">
          <Link to={backTo}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
