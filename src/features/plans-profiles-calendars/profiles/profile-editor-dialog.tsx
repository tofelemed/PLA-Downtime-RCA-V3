import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateProfile, usePatchProfile } from '@/api/v2/queries/profile-commands';
import { CAPACITY_MODELS, RATE_TIMEBASES, type ProfileView } from '@/api/v2/types/profiles';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import {
  emptyProfileForm,
  profileCreateBody,
  profileFormOf,
  profilePatchBody,
  validateProfileForm,
  type FieldErrors,
  type ProfileFormValues,
} from '../model/profile-form';
import { refusalOf } from '../model/refusal';

export interface ProfileEditorDialogProps {
  /** null = closed; `profile` absent = create a draft */
  open: { profile?: ProfileView } | null;
  refs: PlanningRefs;
  onClose: () => void;
  onSaved: (profile: ProfileView) => void;
}

const option = (value: string) => ({ value, label: value });

/** Create a draft profile version or edit a draft (`If-Match`); approved versions are never edited. */
export function ProfileEditorDialog({ open, refs, onClose, onSaved }: ProfileEditorDialogProps) {
  const editing = open?.profile ?? null;
  const [values, setValues] = useState<ProfileFormValues>(emptyProfileForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateProfile();
  const patch = usePatchProfile();
  const command = editing ? patch : create;

  useEffect(() => {
    if (!open) return;
    setValues(open.profile ? profileFormOf(open.profile, refs.timezone) : emptyProfileForm());
    setErrors({});
    create.reset();
    patch.reset();
    // reset only when the dialog opens for another target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(command.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateProfileForm(values, refs.timezone, !editing);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = editing
      ? await patch.submit({ profile: editing, body: profilePatchBody(values, refs.timezone) }).catch(() => null)
      : await create.submit(profileCreateBody(values, refs.timezone)).catch(() => null);
    if (saved) onSaved(saved);
  };

  return (
    <Dialog open={open !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="profile-editor">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit draft profile v${editing.version}` : 'New profile version (draft)'}</DialogTitle>
          <DialogDescription>Drafts are checked and approved by the server; approved versions are never edited.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="unitId" label="Unit" error={fieldError('unitId')}>
            <NativeSelect id="unitId" value={values.unitId} options={refs.unitOptions} placeholder="Choose a unit" disabled={!!editing} onChange={(v) => set('unitId', v)} invalid={!!fieldError('unitId')} />
          </FormField>
          <FormField id="productId" label="Product" error={fieldError('productId')}>
            <NativeSelect id="productId" value={values.productId} options={refs.productOptions} placeholder="Choose a product" disabled={!!editing} onChange={(v) => set('productId', v)} invalid={!!fieldError('productId')} />
          </FormField>
          <FormField id="operatingMode" label="Operating mode" error={fieldError('operatingMode')}>
            <Input id="operatingMode" value={values.operatingMode} disabled={!!editing} onChange={(e) => set('operatingMode', e.target.value)} />
          </FormField>
          <FormField id="quantityUom" label="Quantity unit" error={fieldError('quantityUom')} hint="Unit of every rate of this profile, e.g. t">
            <Input id="quantityUom" value={values.quantityUom} onChange={(e) => set('quantityUom', e.target.value)} />
          </FormField>
          <FormField id="rateTimebase" label="Rate timebase" error={fieldError('rateTimebase')}>
            <NativeSelect id="rateTimebase" value={values.rateTimebase} options={RATE_TIMEBASES.map(option)} placeholder="Choose" onChange={(v) => set('rateTimebase', v as ProfileFormValues['rateTimebase'])} invalid={!!fieldError('rateTimebase')} />
          </FormField>
          <FormField id="capacityModel" label="Capacity model" hint="Shared / independent streams are used by plans only with concurrent products (D14)">
            <NativeSelect id="capacityModel" value={values.capacityModel} options={CAPACITY_MODELS.map(option)} onChange={(v) => set('capacityModel', v as ProfileFormValues['capacityModel'])} />
          </FormField>
          <FormField id="effectiveFrom" label={`Effective from (${refs.timezone})`} error={fieldError('effectiveFrom')}>
            <Input id="effectiveFrom" type="datetime-local" value={values.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
          </FormField>
          <FormField id="effectiveTo" label="Effective to (exclusive, optional)" error={fieldError('effectiveTo')}>
            <Input id="effectiveTo" type="datetime-local" value={values.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
          </FormField>
        </div>
        <RefusalNotice error={command.error} timezone={refs.timezone} onReload={onClose} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={command.isPending} data-testid="profile-save">
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
