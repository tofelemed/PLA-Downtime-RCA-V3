import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProfile, usePatchProfile } from '@/api/v2/queries/profile-commands';
import { CAPACITY_MODELS, RATE_TIMEBASES, type ProfileView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { CAPACITY_MODEL_LABELS, RATE_TIMEBASE_LABELS } from '@/features/ux-kit/labels';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { emptyProfileForm, profileCreateBody, profileFormOf, profilePatchBody, validateProfileForm, type FieldErrors, type ProfileFormValues } from '../model/profile-form';
import { refusalOf } from '../model/refusal';
import { profileCreatedResult } from './profile-created-result';

export interface ProfileEditorProps {
  /** absent = create a draft */
  profile: ProfileView | null;
  refs: PlanningRefs;
  /** Cancel, and for a create the result dialog's "Back to Profiles & rates": the list as the user left it */
  cancelTo: string;
  /** after an edit, and when the result dialog of a create is dismissed: open the saved profile */
  onSaved: (profile: ProfileView) => void;
}

const TIMEBASE_OPTIONS = RATE_TIMEBASES.map((value) => ({ value, label: RATE_TIMEBASE_LABELS[value] }));
const CAPACITY_OPTIONS = CAPACITY_MODELS.map((value) => ({ value, label: CAPACITY_MODEL_LABELS[value] }));

/**
 * Create a draft profile version or edit a draft (`If-Match`); approved versions are never edited. A create
 * ends in the result dialog (View profile · Add another · Back to Profiles & rates · Next), an edit in a
 * toast and the profile page; a refusal is the red alert at the top, input kept. The form is clean after a
 * save, so the dialog's links do not ask about unsaved changes.
 */
export function ProfileEditor({ profile, refs, cancelTo, onSaved }: ProfileEditorProps) {
  const [initial] = useState<ProfileFormValues>(() => (profile ? profileFormOf(profile, refs.timezone) : emptyProfileForm()));
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [baseline, setBaseline] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateProfile();
  const patch = usePatchProfile();
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const command = profile ? patch : create;
  useUnsavedChangesGuard(hasUnsavedChanges(values, baseline, [command.isPending]));
  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];
  const addAnother = () => {
    const empty = emptyProfileForm();
    setValues(empty);
    setBaseline(empty);
    setErrors({});
    feedback.clearFailure();
  };

  const submit = () => {
    if (profile) return feedback.run(() => patch.submit({ profile, body: profilePatchBody(values, refs.timezone) }), 'Draft profile version updated');
    return feedback.run(() => create.submit(profileCreateBody(values, refs.timezone)), (saved) =>
      profileCreatedResult({ saved, refs, capabilities, onAddAnother: addAnother, onDismiss: () => onSaved(saved), listPath: cancelTo }),
    );
  };

  const save = async () => {
    const found = validateProfileForm(values, refs.timezone, !profile);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await submit().catch(() => null);
    if (!saved) return;
    setBaseline(values);
    if (profile) onSaved(saved);
  };

  return (
    <div className="space-y-4" data-testid="profile-editor">
      <SaveRefusalAlert error={feedback.failure} timezone={refs.timezone} />
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
        <FormField id="quantityUom" label="Quantity unit" required error={fieldError('quantityUom')}>
          <Input id="quantityUom" placeholder="e.g. t" value={values.quantityUom} onChange={(e) => set('quantityUom', e.target.value)} />
        </FormField>
        <FormField id="rateTimebase" label="Rate timebase" required error={fieldError('rateTimebase')}>
          <NativeSelect id="rateTimebase" value={values.rateTimebase} options={TIMEBASE_OPTIONS} placeholder="Choose" onChange={(v) => set('rateTimebase', v as ProfileFormValues['rateTimebase'])} invalid={!!fieldError('rateTimebase')} />
        </FormField>
        <FormField id="capacityModel" label="Capacity model">
          <NativeSelect id="capacityModel" value={values.capacityModel} options={CAPACITY_OPTIONS} onChange={(v) => set('capacityModel', v as ProfileFormValues['capacityModel'])} />
        </FormField>
        <PlantDateTimeField id="effectiveFrom" label="Effective from" required value={values.effectiveFrom} timezone={refs.timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="effectiveTo" label="Effective to (exclusive, optional)" value={values.effectiveTo} timezone={refs.timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={command.isPending} data-testid="profile-save">
          Save draft
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
      {feedback.dialog}
    </div>
  );
}
