import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateUnitImpactRule } from '@/api/v2/queries/unit-impact-rules';
import type { UnitImpactMode } from '@/api/v2/types/unit-impact';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect, type Option } from '@/features/plans-profiles-calendars/components/native-select';
import { PlantDateTimeField } from '@/features/plans-profiles-calendars/components/plant-date-time-field';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { useAssetLookup } from '../shared/use-asset-lookup';
import { emptyImpactRuleForm, IMPACT_MODE_LABELS, impactRuleCreateBody, type ImpactRuleFormValues, validateImpactRuleForm } from './impact-rule-form-model';

const MODE_OPTIONS: Option[] = (Object.keys(IMPACT_MODE_LABELS) as UnitImpactMode[]).map((m) => ({ value: m, label: IMPACT_MODE_LABELS[m] }));

export interface ImpactRuleFormProps {
  unitOptions: Option[];
  timezone: string;
  onDone: () => void;
}

/** A draft rule: the unit, the asset, how its stop affects the unit, and the standby that may take over. */
export function ImpactRuleForm({ unitOptions, timezone, onDone }: ImpactRuleFormProps) {
  const [values, setValues] = useState<ImpactRuleFormValues>(emptyImpactRuleForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateUnitImpactRule();
  const { assets } = useAssetLookup();
  const set = <K extends keyof ImpactRuleFormValues>(key: K, value: ImpactRuleFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];
  const assetOptions = assets.filter((a) => !values.unitId || a.unitId === values.unitId).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
  const standbyOptions = assets.filter((a) => a.id !== values.assetId).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  const save = async () => {
    const found = validateImpactRuleForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(impactRuleCreateBody(values, timezone)).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="impact-rule-form">
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField id="impactUnit" label="Unit" error={fieldError('unitId')}>
          <NativeSelect id="impactUnit" value={values.unitId} options={unitOptions} placeholder="Choose…" onChange={(v) => set('unitId', v)} />
        </FormField>
        <FormField id="impactAsset" label="Asset" error={fieldError('assetId')}>
          <NativeSelect id="impactAsset" value={values.assetId} options={assetOptions} placeholder="Choose…" onChange={(v) => set('assetId', v)} />
        </FormField>
        <FormField id="impactMode" label="Impact on the unit" error={fieldError('mode')}>
          <NativeSelect id="impactMode" value={values.mode} options={MODE_OPTIONS} onChange={(v) => set('mode', v as UnitImpactMode)} />
        </FormField>
        {values.mode === 'fractional' && (
          <FormField id="impactPercent" label="Share of the rate lost (%)" error={fieldError('fraction')}>
            <Input id="impactPercent" inputMode="decimal" value={values.percent} placeholder="50" onChange={(e) => set('percent', e.target.value)} />
          </FormField>
        )}
        <FormField id="impactStandby" label="Standby that takes over (optional)" error={fieldError('standbyAssetId')}>
          <NativeSelect id="impactStandby" value={values.standbyAssetId} options={standbyOptions} placeholder="No standby" onChange={(v) => set('standbyAssetId', v)} />
        </FormField>
        <FormField id="impactTakeover" label="Takeover window (s)" error={fieldError('takeoverSeconds')}>
          <Input id="impactTakeover" inputMode="numeric" value={values.takeoverSeconds} onChange={(e) => set('takeoverSeconds', e.target.value)} />
        </FormField>
      </div>
      <FormField id="impactReason" label="Why" error={fieldError('reason')}>
        <Input id="impactReason" value={values.reason} placeholder="One of two feed trains" onChange={(e) => set('reason', e.target.value)} />
      </FormField>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField id="impactFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="impactTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending}>
          Add draft rule
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
