import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PeriodDetailView } from '@/api/v2/types/periods';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { DISPOSITION_CLASS_LABELS, LOT_DISPOSITION_CLASSES } from '@/features/ux-kit/disposition-labels';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { FormField } from '@/features/ux-kit/form-field';
import { useProductNames } from '@/features/ux-kit/labels';
import { useProposeDisposition } from '../hooks/use-disposition-commands';
import { dispositionBody, emptyDisposition, validateDisposition, type DispositionErrors, type DispositionFormValues } from '../model/disposition-form';
import { RecoveryFields } from './recovery-fields';

export interface DispositionFormProps {
  period: PeriodDetailView;
  timezone: string;
  backTo: string;
  onSaved: () => void;
  /** pre-filled values, e.g. a correction of an approved disposition (`correctionOf`) */
  initial?: DispositionFormValues;
}

const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/**
 * SME E3: record what became of (part of) a lot made on the period's unit — or a recovery of reprocessed
 * material — with its production interval (the actuals align to it, not to the lab release) and evidence.
 */
export function DispositionForm({ period, timezone, backTo, onSaved, initial }: DispositionFormProps) {
  const products = useProductNames();
  const [values, setValues] = useState<DispositionFormValues>(() => initial ?? emptyDisposition(period, period.slices[0]?.productId ?? ''));
  const [errors, setErrors] = useState<DispositionErrors>({});
  const propose = useProposeDisposition();
  const set = <K extends keyof DispositionFormValues>(key: K, value: DispositionFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const uom = period.slices.find((s) => s.productId === values.productId)?.quantityUom ?? 't';
  const save = async () => {
    const found = validateDisposition(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await propose.submit(dispositionBody(values, { unitId: period.unitId, uom })).catch(() => null)) onSaved();
  };
  return (
    <div className="space-y-4" data-testid="disposition-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="dispProduct" label="Product" error={errors.productId}>
          <select id="dispProduct" className={SELECT} value={values.productId} disabled={Boolean(values.supersedesId)} onChange={(e) => set('productId', e.target.value)}>
            {period.slices.map((s) => <option key={s.id} value={s.productId}>{products.nameOf(s.productId)}</option>)}
          </select>
        </FormField>
        <FormField id="dispLot" label="Lot number" error={errors.lotCode}>
          <Input id="dispLot" value={values.lotCode} maxLength={64} onChange={(e) => set('lotCode', e.target.value)} />
        </FormField>
        <label className="flex items-center gap-2 text-sm sm:col-span-2" htmlFor="dispRecovery">
          <input id="dispRecovery" type="checkbox" checked={values.recovery} onChange={(e) => set('recovery', e.target.checked)} />
          Recovery of reworked material (saleable again; first-pass good is not changed)
        </label>
        {values.recovery ? (
          <RecoveryFields unitId={period.unitId} before={period.utcEnd} values={values} error={errors.recoveryOfId} set={set} />
        ) : (
          <FormField id="dispClass" label="Disposition">
            <select id="dispClass" className={SELECT} value={values.dispositionClass} onChange={(e) => set('dispositionClass', e.target.value)}>
              {LOT_DISPOSITION_CLASSES.map((value) => <option key={value} value={value}>{DISPOSITION_CLASS_LABELS[value]}</option>)}
            </select>
          </FormField>
        )}
        <FormField id="dispQuantity" label={`Quantity (${uom})`} error={errors.quantity}>
          <DecimalInput id="dispQuantity" value={values.quantity} onChange={(v) => set('quantity', v)} />
        </FormField>
        <DateTimeInput label="Produced from" value={values.productionStart} timeZone={timezone} error={errors.productionStart ?? null} onChange={(v) => set('productionStart', v)} />
        <DateTimeInput label="Produced to" value={values.productionEnd} timeZone={timezone} error={errors.productionEnd ?? null} onChange={(v) => set('productionEnd', v)} />
        <DateTimeInput label="Lab released (optional)" value={values.labReleasedAt} timeZone={timezone} onChange={(v) => set('labReleasedAt', v)} />
        <FormField id="dispEvidence" label="Evidence (lab certificate, sample number)">
          <Input id="dispEvidence" value={values.evidenceRef} onChange={(e) => set('evidenceRef', e.target.value)} />
        </FormField>
        <FormField id="dispReason" label="Note (optional)">
          <Textarea id="dispReason" rows={2} value={values.reason} onChange={(e) => set('reason', e.target.value)} />
        </FormField>
      </div>
      {propose.error !== null && <FriendlyErrorAlert error={propose.error} title="The disposition was not saved" />}
      <div className="flex gap-2">
        <Button onClick={save} disabled={propose.isPending} data-testid="disposition-save">{values.supersedesId ? 'Propose the correction' : 'Record disposition'}</Button>
        <Button asChild variant="outline"><Link to={backTo}>Cancel</Link></Button>
      </div>
    </div>
  );
}
