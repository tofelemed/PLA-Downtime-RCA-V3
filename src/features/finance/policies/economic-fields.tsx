import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QUALITY_DISPOSITIONS, type DemandRule, type FxDateRule, type FxRateType, type QualityDisposition } from '@/api/v2/types/valuation';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DEMAND_RULE_LABELS, FX_DATE_RULE_LABELS, FX_RATE_TYPE_LABELS, QUALITY_DISPOSITION_LABELS } from '@/features/ux-kit/labels';
import { FinanceField } from '../components/finance-field';
import type { EconomicFormValues } from '../model/policy-economic';
import { ImpactCodePicker } from './impact-code-picker';

const options = (labels: Readonly<Record<string, string>>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const DEMAND_OPTIONS = [...options(DEMAND_RULE_LABELS), { value: 'none', label: 'No economic view' }];
const DISPOSITION_OPTIONS = [...options(QUALITY_DISPOSITION_LABELS), { value: 'none', label: 'None: unmapped quality losses stay unvalued' }];

export interface EconomicFieldsProps {
  values: EconomicFormValues;
  errors: (key: string) => string | undefined;
  onChange: (values: EconomicFormValues) => void;
}

/** Which impact codes name each disposition; a code belongs to at most one. */
function DispositionPickers({ values, onChange }: Pick<EconomicFieldsProps, 'values' | 'onChange'>) {
  const idsOf = (d: QualityDisposition) => Object.entries(values.qualityDispositions).filter(([, v]) => v === d).map(([id]) => id);
  const assign = (d: QualityDisposition, ids: string[]) => {
    const kept = Object.entries(values.qualityDispositions).filter(([id, v]) => v !== d && !ids.includes(id));
    onChange({ ...values, qualityDispositions: Object.fromEntries([...kept, ...ids.map((id) => [id, d] as const)]) });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {QUALITY_DISPOSITIONS.map((d) => (
        <ImpactCodePicker
          key={d}
          selected={idsOf(d)}
          onChange={(ids) => assign(d, ids)}
          legend={`Quality losses disposed as ${QUALITY_DISPOSITION_LABELS[d].toLowerCase()}`}
          checkLabel={QUALITY_DISPOSITION_LABELS[d]}
          testId={`disposition-${d}`}
        />
      ))}
    </div>
  );
}

/**
 * Version-3 settings of a valuation policy (SME V2–V6): the FX rate table and date rule, whether lost
 * output is a lost sale only when the product was sold out, how quality losses are disposed, and whether
 * manual downtime lines get an hourly cost from their evidenced events. The server applies them.
 */
export function EconomicFields({ values, errors, onChange }: EconomicFieldsProps) {
  const set = <K extends keyof EconomicFormValues>(key: K, value: EconomicFormValues[K]) => onChange({ ...values, [key]: value });
  const economic = values.demandRule !== 'none';
  return (
    <fieldset className="space-y-4 rounded-md border p-3" data-testid="economic-fields">
      <legend className="px-1 text-sm font-medium">Exchange rates and economic view</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceField id="fxRateType" label="Exchange-rate table" error={errors('fxRateType')}>
          <NativeSelect id="fxRateType" value={values.fxRateType} options={options(FX_RATE_TYPE_LABELS)} onChange={(v) => set('fxRateType', v as FxRateType)} />
        </FinanceField>
        <FinanceField id="fxDateRule" label="Rate date" error={errors('fxDateRule')}>
          <NativeSelect id="fxDateRule" value={values.fxDateRule} options={options(FX_DATE_RULE_LABELS)} onChange={(v) => set('fxDateRule', v as FxDateRule)} />
        </FinanceField>
        {values.fxDateRule === 'period_average' && (
          <FinanceField id="fxAverageMaxDeviation" label="Refuse the average beyond (ratio)" hint="e.g. 0.05 = a rate more than 5 % from the average" error={errors('fxAverageMaxDeviation')}>
            <Input id="fxAverageMaxDeviation" value={values.fxAverageMaxDeviation} onChange={(e) => set('fxAverageMaxDeviation', e.target.value)} />
          </FinanceField>
        )}
        <FinanceField id="demandRule" label="Lost sales" error={errors('demandRule')}>
          <NativeSelect id="demandRule" value={values.demandRule} options={DEMAND_OPTIONS} onChange={(v) => set('demandRule', v as DemandRule | 'none')} />
        </FinanceField>
        {economic && (
          <FinanceField id="defaultQualityDisposition" label="Quality losses without a mapped code" error={errors('defaultQualityDisposition')}>
            <NativeSelect id="defaultQualityDisposition" value={values.defaultQualityDisposition} options={DISPOSITION_OPTIONS} onChange={(v) => set('defaultQualityDisposition', v as QualityDisposition | 'none')} />
          </FinanceField>
        )}
      </div>
      {economic && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox id="manualLineHours" checked={values.manualLineHours} onCheckedChange={(on) => set('manualLineHours', on === true)} />
            <Label htmlFor="manualLineHours">Manual downtime lines get an hourly cost for the hours of their evidenced events</Label>
          </div>
          <DispositionPickers values={values} onChange={onChange} />
        </>
      )}
    </fieldset>
  );
}
