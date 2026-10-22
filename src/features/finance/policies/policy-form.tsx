import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateValuationPolicy } from '@/api/v2/queries/valuation';
import type { DefaultBasis, FxPolicy, TimeBasisRule, ValuationPolicyView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DEFAULT_BASIS_LABELS, FX_POLICY_LABELS, TIME_BASIS_RULE_LABELS } from '@/features/ux-kit/labels';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { useCalendarPreference } from '@/lib/dates';
import { FinanceField } from '../components/finance-field';
import { serverFieldErrors, type FieldErrors } from '../model/field-errors';
import { POLICY_FIELD_VOCABULARY } from '../model/policy-field-vocabulary';
import { policyCreateBody, policyFormOf, REPORTING_CURRENCIES, validatePolicyForm, type PolicyFormValues } from '../model/policy-form';
import { EconomicFields } from './economic-fields';
import { ImpactCodePicker } from './impact-code-picker';
import { PolicyBackdateFields } from './policy-backdate-fields';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export interface PolicyFormProps {
  source: ValuationPolicyView | null;
  /** default basis of a fresh version (the version in force) */
  freshBasis?: DefaultBasis | null;
  /** the saved version: the page shows the result dialog */
  onSaved: (policy: ValuationPolicyView) => void;
  /** where Cancel goes (a fixed link, never browser history) */
  cancelTo: string;
}

function CurrencyChoice({ values, toggle }: { values: PolicyFormValues; toggle: (code: string, on: boolean) => void }) {
  return (
    <div className="flex gap-4" id="reportingCurrencies" role="group" aria-label="Reporting currencies">
      {REPORTING_CURRENCIES.map((code) => (
        <div key={code} className="flex items-center gap-1">
          <Checkbox id={`currency-${code}`} checked={values.reportingCurrencies.includes(code)} onCheckedChange={(on) => toggle(code, on === true)} />
          <Label htmlFor={`currency-${code}`}>{code}</Label>
        </div>
      ))}
    </div>
  );
}

/**
 * A new valuation policy version, not approved yet; a finance approver (not the author) records the sign-off
 * afterwards (SME V1). A refused save is the red alert at the top (the input stays); a saved one is reported
 * by the page (`onSaved`).
 */
export function PolicyForm({ source, freshBasis = null, onSaved, cancelTo }: PolicyFormProps) {
  const { timezone } = usePlantDates();
  const calendar = useCalendarPreference().calendar;
  const initial = useMemo(() => policyFormOf(source, freshBasis), [source, freshBasis]);
  const [values, setValues] = useState<PolicyFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const create = useCreateValuationPolicy();
  const feedback = useSaveFeedback(POLICY_FIELD_VOCABULARY);
  useUnsavedChangesGuard(hasUnsavedChanges(values, initial, [create.isPending, saved]));
  const set = <K extends keyof PolicyFormValues>(key: K, value: PolicyFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const serverErrors = serverFieldErrors(create.error, POLICY_FIELD_VOCABULARY);
  const fieldError = (key: string) => errors[key] ?? serverErrors[key];
  const toggleCurrency = (code: string, on: boolean) =>
    set('reportingCurrencies', on ? [...values.reportingCurrencies, code] : values.reportingCurrencies.filter((entry) => entry !== code));
  const save = async () => {
    const found = validatePolicyForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const policy = await feedback.run(() => create.submit(policyCreateBody(values)), null).catch(() => null);
    if (!policy) return;
    setSaved(true);
    onSaved(policy);
  };
  return (
    <div className="space-y-4" data-testid="policy-form">
      {feedback.alert}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceField id="defaultBasis" label="Default management view" error={fieldError('defaultBasis')}>
          <NativeSelect id="defaultBasis" value={values.defaultBasis} options={options(DEFAULT_BASIS_LABELS)} onChange={(v) => set('defaultBasis', v as DefaultBasis)} />
        </FinanceField>
        <FinanceField id="timeBasisRule" label="Time-based costs">
          <NativeSelect id="timeBasisRule" value={values.timeBasisRule} options={options(TIME_BASIS_RULE_LABELS)} onChange={(v) => set('timeBasisRule', v as TimeBasisRule)} />
        </FinanceField>
        <FinanceField id="fxPolicy" label="Currency conversion">
          <NativeSelect id="fxPolicy" value={values.fxPolicy} options={options(FX_POLICY_LABELS)} onChange={(v) => set('fxPolicy', v as FxPolicy)} />
        </FinanceField>
      </div>
      <FinanceField id="effectiveFrom" label="Starts" withLabel={false} error={fieldError('effectiveFrom')}>
        <DateTimeInput
          label={`Starts (${timezone})`}
          value={values.effectiveFrom}
          timeZone={timezone}
          calendar={calendar}
          onChange={(iso) => set('effectiveFrom', iso)}
          required={values.backdate.effectiveFrom === null}
          disabled={values.backdate.effectiveFrom !== null}
        />
      </FinanceField>
      <PolicyBackdateFields
        backdate={values.backdate}
        restateApproved={values.restateApproved}
        onBackdate={(backdate) => set('backdate', backdate)}
        onRestate={(restate) => set('restateApproved', restate)}
        errors={{ ...serverErrors, ...errors }}
        saveError={create.error}
      />
      <FinanceField id="reportingCurrencies" label="Reporting currencies" error={fieldError('reportingCurrencies')}>
        <CurrencyChoice values={values} toggle={toggleCurrency} />
      </FinanceField>
      <EconomicFields values={values.economic} errors={fieldError} onChange={(economic) => set('economic', economic)} />
      {values.timeBasisRule === 'independent_components' && (
        <ImpactCodePicker selected={values.independentImpactCodeIds} onChange={(ids) => set('independentImpactCodeIds', ids)} />
      )}
      <FinanceField id="policyNotes" label="Notes (optional)" error={fieldError('notes')}>
        <Textarea id="policyNotes" value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </FinanceField>
      <div className="flex gap-2">
        <Button onClick={save} disabled={create.isPending || saved} data-testid="policy-save">
          Save version (not approved)
        </Button>
        <Button variant="outline" asChild>
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
