import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateValuationPolicy } from '@/api/v2/queries/valuation';
import type { DefaultBasis, FxPolicy, TimeBasisRule, ValuationPolicyView } from '@/api/v2/types/valuation';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect } from '@/features/plans-profiles-calendars/components/native-select';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { policyCreateBody, policyFormOf, REPORTING_CURRENCIES, validatePolicyForm, type PolicyFormValues } from '../model/policy-form';
import { ImpactCodePicker } from './impact-code-picker';

const BASES = [
  { value: 'contribution_margin', label: 'Contribution margin' },
  { value: 'standard_cost', label: 'Standard cost' },
];
const TIME_RULES = [
  { value: 'exclusive', label: 'Exclusive (one basis per loss)' },
  { value: 'independent_components', label: 'Independent components (listed impact codes)' },
];
const FX = [
  { value: 'snapshot', label: 'Approved FX table' },
  { value: 'none', label: 'No conversion' },
];

export interface PolicyFormProps {
  source: ValuationPolicyView | null;
  timezone: string;
  onDone: () => void;
}

/** A new, unapproved valuation policy version; another manager approver records the sign-off afterwards. */
export function PolicyForm({ source, timezone, onDone }: PolicyFormProps) {
  const [values, setValues] = useState<PolicyFormValues>(() => policyFormOf(source));
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateValuationPolicy();
  const set = <K extends keyof PolicyFormValues>(key: K, value: PolicyFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];
  const toggleCurrency = (code: string, on: boolean) =>
    set('reportingCurrencies', on ? [...values.reportingCurrencies, code] : values.reportingCurrencies.filter((entry) => entry !== code));

  const save = async () => {
    const found = validatePolicyForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(policyCreateBody(values, timezone)).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="policy-form">
      <p className="text-sm font-medium">{source ? `New version from v${source.version}` : 'New valuation policy version'}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="defaultBasis" label="Default basis">
          <NativeSelect id="defaultBasis" value={values.defaultBasis} options={BASES} onChange={(v) => set('defaultBasis', v as DefaultBasis)} />
        </FormField>
        <FormField id="timeBasisRule" label="Time-based costs">
          <NativeSelect id="timeBasisRule" value={values.timeBasisRule} options={TIME_RULES} onChange={(v) => set('timeBasisRule', v as TimeBasisRule)} />
        </FormField>
        <FormField id="fxPolicy" label="FX conversion">
          <NativeSelect id="fxPolicy" value={values.fxPolicy} options={FX} onChange={(v) => set('fxPolicy', v as FxPolicy)} />
        </FormField>
        <FormField id="policyEffectiveFrom" label={`From (${timezone})`} error={fieldError('effectiveFrom')}>
          <Input id="policyEffectiveFrom" type="datetime-local" value={values.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
        </FormField>
      </div>
      <FormField id="reportingCurrencies" label="Reporting currencies" error={fieldError('reportingCurrencies')}>
        <div className="flex gap-4" id="reportingCurrencies">
          {REPORTING_CURRENCIES.map((code) => (
            <div key={code} className="flex items-center gap-1">
              <Checkbox id={`currency-${code}`} checked={values.reportingCurrencies.includes(code)} onCheckedChange={(on) => toggleCurrency(code, on === true)} />
              <Label htmlFor={`currency-${code}`}>{code}</Label>
            </div>
          ))}
        </div>
      </FormField>
      {values.timeBasisRule === 'independent_components' && (
        <ImpactCodePicker selected={values.independentImpactCodeIds} onChange={(ids) => set('independentImpactCodeIds', ids)} />
      )}
      <FormField id="policyNotes" label="Notes (optional)" error={fieldError('notes')}>
        <Textarea id="policyNotes" value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </FormField>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending} data-testid="policy-save">
          Save unapproved version
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
