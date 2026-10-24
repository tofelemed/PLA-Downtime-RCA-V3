import { useId, useState, type FormEvent } from 'react';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useGrantableRoles } from '@/api/v2/queries/administration-users';
import { usePlantOptions } from '@/api/v2/queries/administration-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/features/admin/shared/form-field';
import { roleLabel } from '@/features/ux-kit/labels';
import { StatusIcon } from '@/lib/icons';
import { type UserFormErrors, type UserFormValues, MIN_PASSWORD_LENGTH, signInTypeHint, validateUserForm } from '../model/user-form';

export interface UserDetailsFormProps {
  mode: 'create' | 'edit';
  initial: UserFormValues;
  /** super and organization administrators choose the home plant of a new user */
  choosePlant: boolean;
  readOnly?: boolean;
  submitLabel: string;
  onSubmit: (values: UserFormValues) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Name, e-mail, password, sign-in type (the legacy role, only types the server lets you give) and, for new
 * users, the plant. Plant roles are given under Access; the sign-in type is hidden on a read-only profile.
 */
export function UserDetailsForm({ mode, initial, choosePlant, readOnly = false, submitLabel, onSubmit, onCancel }: UserDetailsFormProps) {
  const ids = { name: useId(), email: useId(), password: useId(), role: useId(), plant: useId() };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<UserFormValues>) => setValues((current) => ({ ...current, ...patch }));
  useUnsavedChangesGuard(hasUnsavedChanges(values, initial, [readOnly, busy]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateUserForm(values, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await onSubmit(values);
    } catch {
      // the toast explains the refusal; the form keeps what was typed
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) return <ReadOnlyDetails values={values} />;
  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
      <FormField htmlFor={ids.name} label="Name" error={errors.name} required>
        <Input id={ids.name} className="h-9" value={values.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
      </FormField>
      <FormField htmlFor={ids.email} label="E-mail" error={errors.email} required>
        <Input id={ids.email} type="email" className="h-9" value={values.email} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
      </FormField>
      <SignInTypeField id={ids.role} mode={mode} value={values.role} current={initial.role} error={errors.role} onChange={(role) => set({ role })} />
      <FormField
        htmlFor={ids.password}
        label={mode === 'create' ? 'Password' : 'New password'}
        hint={mode === 'create' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : 'Leave empty to keep the current password.'}
        error={errors.password}
        required={mode === 'create'}
      >
        <Input id={ids.password} type="password" className="h-9" value={values.password} autoComplete="new-password" onChange={(e) => set({ password: e.target.value })} />
      </FormField>
      {mode === 'create' && choosePlant && <PlantField id={ids.plant} value={values.tenantId} onChange={(tenantId) => set({ tenantId })} />}
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

function FormButtons({ busy, submitLabel, onCancel }: { busy: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2 sm:col-span-2">
      <Button type="button" variant="outline" className="h-9" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" className="h-9" disabled={busy} aria-busy={busy || undefined}>
        {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

/** A profile the caller may not change: its values as text (no disabled inputs); no password or sign-in type. */
function ReadOnlyDetails({ values }: { values: UserFormValues }) {
  return (
    <dl className="grid max-w-2xl gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]" data-testid="user-details-read-only">
      <dt className="text-muted-foreground">Name</dt>
      <dd>{values.name}</dd>
      <dt className="text-muted-foreground">E-mail</dt>
      <dd className="break-all">{values.email}</dd>
    </dl>
  );
}

interface SignInTypeFieldProps {
  id: string;
  mode: 'create' | 'edit';
  value: string;
  /** the type the user has now (kept selectable even when you could not give it) */
  current: string;
  error?: string;
  onChange: (role: UserFormValues['role']) => void;
}

/**
 * QA re-test 2026-10-19 (DECISIONS "Legacy role = sign-in / display compatibility only"): the legacy role is the
 * sign-in type. It gives the first plant role in the home plant, and counts as a plant role only while the
 * user holds no plant role there; what the user may do is the plant roles under Access.
 */
function SignInTypeField({ id, mode, value, current, error, onChange }: SignInTypeFieldProps) {
  const grantable = useGrantableRoles();
  const roles: readonly string[] = grantable.data?.roles ?? [];
  const options = current && !roles.includes(current) ? [current, ...roles] : roles;
  return (
    <FormField htmlFor={id} label="Sign-in type" error={error} hint={signInTypeHint(mode)} required={mode === 'create'}>
      <Select value={value} onValueChange={(role) => onChange(role as UserFormValues['role'])} disabled={grantable.isLoading}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={grantable.isLoading ? 'Loading sign-in types…' : 'Choose a sign-in type'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((role) => (
            <SelectItem key={role} value={role} disabled={!roles.includes(role)}>
              {roleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function PlantField({ id, value, onChange }: { id: string; value: string; onChange: (tenantId: string) => void }) {
  const plants = usePlantOptions();
  const items = plants.data?.items ?? [];
  return (
    <FormField htmlFor={id} label="Plant">
      <Select value={value} onValueChange={onChange} disabled={plants.isLoading}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder="The selected plant" />
        </SelectTrigger>
        <SelectContent>
          {items.map((plant) => (
            <SelectItem key={plant.id} value={plant.id}>
              {plant.organizationName ? `${plant.name} (${plant.organizationName})` : plant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
