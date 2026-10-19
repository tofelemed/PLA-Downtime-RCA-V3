import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProfile, usePatchProfile } from '@/api/v2/queries/profile-commands';
import { CAPACITY_MODELS, RATE_TIMEBASES, type ProfileView } from '@/api/v2/types/profiles';
import { CAPACITY_MODEL_LABELS, RATE_TIMEBASE_LABELS } from '@/features/ux-kit/labels';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { RefusalNotice } from '../components/refusal-notice';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { emptyProfileForm, profileCreateBody, profileFormOf, profilePatchBody, validateProfileForm, type FieldErrors, type ProfileFormValues } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

export interface ProfileEditorProps {
  /** absent = create a draft */
  profile: ProfileView | null;
  refs: PlanningRefs;
  cancelTo: string;
  onSaved: (profile: ProfileView) => void;
}

const TIMEBASE_OPTIONS = RATE_TIMEBASES.map((value) => ({ value, label: RATE_TIMEBASE_LABELS[value] }));
const CAPACITY_OPTIONS = CAPACITY_MODELS.map((value) => ({ value, label: CAPACITY_MODEL_LABELS[value] }));

/** Create a draft profile version or edit a draft (`If-Match`); approved versions are never edited. */
export function ProfileEditor({ profile, refs, cancelTo, onSaved }: ProfileEditorProps) {
  const [initial] = useState<ProfileFormValues>(() => (profile ? profileFormOf(profile, refs.timezone) : emptyProfileForm()));
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateProfile();
  const patch = usePatchProfile();
  const command = profile ? patch : create;
  useUnsavedChangesGuard(hasUnsavedChanges(values, initial, [command.isPending]));
  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(command.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateProfileForm(values, refs.timezone, !profile);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = profile
      ? await patch.submit({ profile, body: profilePatchBody(values, refs.timezone) }).catch(() => null)
      : await create.submit(profileCreateBody(values, refs.timezone)).catch(() => null);
    if (saved) onSaved(saved);
  };

  return (
    <div className="space-y-4" data-testid="profile-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="unitId" label="Unit" error={fieldError('unitId')} required={!profile}>
          <NativeSelect id="unitId" value={values.unitId} options={refs.unitOptions} placeholder="Choose a unit" disabled={!!profile} onChange={(v) => set('unitId', v)} invalid={!!fieldError('unitId')} />
        </FormField>
        <FormField id="productId" label="Product" error={fieldError('productId')} required={!profile}>
          <NativeSelect id="productId" value={values.productId} options={refs.productOptions} placeholder="Choose a product" disabled={!!profile} onChange={(v) => set('productId', v)} invalid={!!fieldError('productId')} />
        </FormField>
        <FormField id="operatingMode" label="Operating mode" error={fieldError('operatingMode')} required={!profile}>
          <Input id="operatingMode" value={values.operatingMode} disabled={!!profile} onChange={(e) => set('operatingMode', e.target.value)} />
        </FormField>
        <FormField id="quantityUom" label="Quantity unit" required error={fieldError('quantityUom')} hint="Unit of every rate of this profile, e.g. t">
          <Input id="quantityUom" value={values.quantityUom} onChange={(e) => set('quantityUom', e.target.value)} />
        </FormField>
        <FormField id="rateTimebase" label="Rate timebase" required error={fieldError('rateTimebase')}>
          <NativeSelect id="rateTimebase" value={values.rateTimebase} options={TIMEBASE_OPTIONS} placeholder="Choose" onChange={(v) => set('rateTimebase', v as ProfileFormValues['rateTimebase'])} invalid={!!fieldError('rateTimebase')} />
        </FormField>
        <FormField id="capacityModel" label="Capacity model" hint="Shared or independent streams matter only when products run at the same time">
          <NativeSelect id="capacityModel" value={values.capacityModel} options={CAPACITY_OPTIONS} onChange={(v) => set('capacityModel', v as ProfileFormValues['capacityModel'])} />
        </FormField>
        <PlantDateTimeField id="effectiveFrom" label="Effective from" required value={values.effectiveFrom} timezone={refs.timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="effectiveTo" label="Effective to (exclusive, optional)" value={values.effectiveTo} timezone={refs.timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <RefusalNotice error={command.error} timezone={refs.timezone} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={command.isPending} data-testid="profile-save">
          Save draft
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
