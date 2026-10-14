import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateDemandStatus } from '@/api/v2/queries/demand-statuses';
import { useProducts } from '@/api/v2/queries/profiles';
import type { DemandStatusValue } from '@/api/v2/types/valuation';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DEMAND_STATUS_LABELS } from '@/features/ux-kit/labels';
import { useCalendarPreference } from '@/lib/dates';
import { FinanceField } from '../components/finance-field';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';
import { serverFieldErrors, validityErrors, type FieldErrors } from '../model/field-errors';

interface DemandFormValues {
  productId: string;
  status: DemandStatusValue;
  evidence: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

const STATUS_OPTIONS = Object.entries(DEMAND_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function validate(values: DemandFormValues): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo);
  if (!values.productId) errors.productId = 'Choose a product.';
  if (!values.evidence.trim()) errors.evidence = 'Say what shows it: orders, inventory cover, catch-up.';
  return errors;
}

export interface DemandStatusFormProps {
  timezone: string;
  onSaved: () => void;
  onCancel: () => void;
}

/** A draft sold-out status of a product (SME V3); a finance approver approves it, never its author. */
export function DemandStatusForm({ timezone, onSaved, onCancel }: DemandStatusFormProps) {
  const calendar = useCalendarPreference().calendar;
  const products = useProducts();
  const [values, setValues] = useState<DemandFormValues>({ productId: '', status: 'demand_constrained', evidence: '', effectiveFrom: null, effectiveTo: null });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateDemandStatus();
  const set = <K extends keyof DemandFormValues>(key: K, value: DemandFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? serverFieldErrors(create.error)[key];
  const productOptions = (products.data?.pages.flatMap((page) => page.items) ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  const save = async () => {
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { productId: values.productId, status: values.status, evidence: values.evidence.trim(), effectiveFrom: values.effectiveFrom as string, effectiveTo: values.effectiveTo };
    const saved = await create.submit(body).catch(() => null);
    if (saved) onSaved();
  };
  return (
    <div className="space-y-3" data-testid="demand-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField id="demandProduct" label="Product" error={fieldError('productId')}>
          <NativeSelect id="demandProduct" value={values.productId} options={productOptions} placeholder="Choose a product" onChange={(v) => set('productId', v)} />
        </FinanceField>
        <FinanceField id="demandStatus" label="Demand" error={fieldError('status')}>
          <NativeSelect id="demandStatus" value={values.status} options={STATUS_OPTIONS} onChange={(v) => set('status', v as DemandStatusValue)} />
        </FinanceField>
      </div>
      <FinanceField id="effectiveFrom" label="Valid from" withLabel={false} error={fieldError('effectiveFrom')}>
        <DateTimeInput label={`Valid from (${timezone})`} value={values.effectiveFrom} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveFrom', iso)} required />
      </FinanceField>
      <FinanceField id="effectiveTo" label="Valid until" withLabel={false} error={fieldError('effectiveTo')}>
        <DateTimeInput label="Valid until (optional)" value={values.effectiveTo} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveTo', iso)} />
      </FinanceField>
      <FinanceField id="demandEvidence" label="Evidence" error={fieldError('evidence')}>
        <Textarea id="demandEvidence" value={values.evidence} onChange={(e) => set('evidence', e.target.value)} />
      </FinanceField>
      <FinanceRefusalAlert error={create.error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={create.isPending} data-testid="demand-save">
          Save draft
        </Button>
      </div>
    </div>
  );
}
