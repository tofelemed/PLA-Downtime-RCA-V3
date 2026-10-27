import { useState, type ReactNode } from 'react';
import { useDraftLossAccountingVersion } from '@/api/v2/queries/loss-accounting';
import { useProducts } from '@/api/v2/queries/profiles';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { LossAccountingPolicyView } from '@/api/v2/types/loss-accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ConsoleRefusal } from '@/features/integration-console/components/console-refusal';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE, type BackdateErrors } from '@/features/policy-backdate/backdate-model';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import {
  BASIS_OPTIONS, GRAIN_OPTIONS, TARGET_OPTIONS, initialLossAccountingForm, lossAccountingBody, lossAccountingErrors, withLossBasis,
  type LossAccountingFormErrors,
} from './loss-accounting-model';

const GRAIN_INFO = 'One accounting period per shift, or one per day starting at the day start.';
const BASIS_INFO =
  "Computed: the loss is target − measured actual, explained by stops and quality events. Declared: the loss is the shortfall OT reports in its production loss event, coded by reason in the Event Hub; stops no longer price the loss and OEE is not available.";
const TARGET_INFO = "Traverse Forge plan, or the planned figure in OT's event.";
const MAX_TOLERANCE = 1_000_000;
const PRODUCT_HINT = 'Product the declared figures are booked to when the unit runs several products and no plan covers the day';
const EFFECTIVE_INFO = 'The new rules apply from this date. Approved periods before it are untouched; open ones are rebuilt.';

function Labelled({ text, info }: { text: string; info: string }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <KpiInfo label={text} text={info} />
    </span>
  );
}

/**
 * Drafts a new plant-wide loss accounting version, starting from the one in force. It applies once production
 * accounting or the manager approves it (never its author); the server checks the rest and its refusal is shown as it is.
 */
export function LossAccountingForm({ base, onDone }: { base: LossAccountingPolicyView; onDone: () => void }) {
  const draft = useDraftLossAccountingVersion();
  const units = useUnits();
  const products = useProducts();
  const [values, setValues] = useState(() => initialLossAccountingForm(base));
  const [errors, setErrors] = useState<LossAccountingFormErrors>({});
  const [backdate, setBackdate] = useState(EMPTY_BACKDATE);
  const [backdateProblems, setBackdateProblems] = useState<BackdateErrors>({});
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const unitOptions = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name }));
  const productOptions = flattenPages(products.data?.pages).map((product) => ({ value: product.id, label: `${product.code} ${product.name}` }));
  const declared = values.lossBasis === 'declared';

  const save = () => {
    const found = lossAccountingErrors(values);
    const backdateFound = backdateErrors(backdate);
    setErrors(found);
    setBackdateProblems(backdateFound);
    if (Object.keys(found).length > 0 || Object.keys(backdateFound).length > 0) return;
    draft.submit({ ...lossAccountingBody(values, base), ...backdateBodyOf(backdate) }).then(onDone, () => undefined);
  };

  return (
    <div className="space-y-3" data-testid="loss-accounting-form">
      <Field id="loss-grain" label={<Labelled text="Grain" info={GRAIN_INFO} />}>
        <NativeSelect id="loss-grain" testId="loss-grain" value={values.grain} onChange={(v) => set('grain', v === 'day' ? 'day' : 'shift')} options={GRAIN_OPTIONS} />
      </Field>
      {values.grain === 'day' && (
        <Field id="loss-day-start" label="Day start" error={errors.dayStart} hint="Plant time, e.g. 00:00">
          <Input id="loss-day-start" type="time" value={values.dayStart} onChange={(e) => set('dayStart', e.target.value)} data-testid="loss-day-start" />
        </Field>
      )}
      <Field id="loss-basis" label={<Labelled text="Loss basis" info={BASIS_INFO} />}>
        <NativeSelect id="loss-basis" testId="loss-basis" value={values.lossBasis} onChange={(v) => setValues(withLossBasis(values, v === 'declared' ? 'declared' : 'computed'))} options={BASIS_OPTIONS} />
      </Field>
      {declared && (
        <>
          <Field id="loss-target" label={<Labelled text="Target" info={TARGET_INFO} />}>
            <NativeSelect id="loss-target" testId="loss-target" value={values.targetSource} onChange={(v) => set('targetSource', v === 'plan' ? 'plan' : 'declared')} options={TARGET_OPTIONS} />
          </Field>
          <Field id="loss-unit" label="Accounting unit" required error={errors.accountingUnitId} hint="The unit whose OT production loss event is accounted">
            <NativeSelect id="loss-unit" testId="loss-unit" value={values.accountingUnitId} onChange={(v) => set('accountingUnitId', v)} options={unitOptions} placeholder="Choose a unit" />
          </Field>
          <Field id="loss-product" label="Accounting product" hint={PRODUCT_HINT}>
            <NativeSelect id="loss-product" testId="loss-product" value={values.accountingProductId} onChange={(v) => set('accountingProductId', v)} options={productOptions} placeholder="None" />
          </Field>
          <Field id="loss-tolerance" label="Identity tolerance (t)" error={errors.identityTolerance} hint="How far target − actual may differ from the declared shortfall, in the event's unit">
            <Input id="loss-tolerance" type="number" min={0} max={MAX_TOLERANCE} step="any" value={values.identityTolerance} onChange={(e) => set('identityTolerance', e.target.value)} data-testid="loss-tolerance" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={values.stopsCrossCheck} onCheckedChange={(on) => set('stopsCrossCheck', on)} data-testid="loss-cross-check" />
            Stops cross-check
          </label>
        </>
      )}
      <p className="flex items-center gap-1 text-sm font-medium">
        Effective from
        <KpiInfo label="Effective from" text={EFFECTIVE_INFO} />
        <span className="font-normal text-muted-foreground">· when it is approved, unless a past commissioning date is given</span>
      </p>
      <CommissioningBackdateFields idPrefix="loss" value={backdate} onChange={setBackdate} errors={backdateProblems} takesEffect="approval" />
      <ConsoleRefusal error={draft.error} />
      <BackdateOverlapList error={draft.error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={draft.isPending} data-testid="loss-save">
          Save draft
        </Button>
      </div>
    </div>
  );
}
