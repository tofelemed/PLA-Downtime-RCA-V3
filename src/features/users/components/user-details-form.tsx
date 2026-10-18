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
import { type UserFormErrors, type UserFormValues, MIN_PASSWORD_LENGTH, validateUserForm } from '../model/user-form';

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

/** Name, e-mail, password, role (only roles the server lets you give) and, for new users, the plant. */
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

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
      <FormField htmlFor={ids.name} label="Name" error={errors.name} required>
        <Input id={ids.name} value={values.name} disabled={readOnly} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
      </FormField>
      <FormField htmlFor={ids.email} label="E-mail" error={errors.email} required>
        <Input id={ids.email} type="email" value={values.email} disabled={readOnly} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
      </FormField>
      <RoleField id={ids.role} value={values.role} current={initial.role} disabled={readOnly} error={errors.role} onChange={(role) => set({ role })} />
      {!readOnly && (
        <FormField
          htmlFor={ids.password}
          label={mode === 'create' ? 'Password' : 'New password'}
          hint={mode === 'create' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : 'Leave empty to keep the current password.'}
          error={errors.password}
          required={mode === 'create'}
        >
          <Input id={ids.password} type="password" value={values.password} autoComplete="new-password" onChange={(e) => set({ password: e.target.value })} />
        </FormField>
      )}
      {mode === 'create' && choosePlant && <PlantField id={ids.plant} value={values.tenantId} onChange={(tenantId) => set({ tenantId })} />}
      {!readOnly && (
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}

interface RoleFieldProps {
  id: string;
  value: string;
  /** the role the user has now (kept selectable even when you could not give it) */
  current: string;
  disabled: boolean;
  error?: string;
  onChange: (role: UserFormValues['role']) => void;
}

function RoleField({ id, value, current, disabled, error, onChange }: RoleFieldProps) {
  const grantable = useGrantableRoles();
  const roles: readonly string[] = grantable.data?.roles ?? [];
  const options = current && !roles.includes(current) ? [current, ...roles] : roles;
  return (
    <FormField htmlFor={id} label="Role" error={error} hint="You can give roles up to your own." required>
      <Select value={value} onValueChange={(role) => onChange(role as UserFormValues['role'])} disabled={disabled || grantable.isLoading}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={grantable.isLoading ? 'Loading roles…' : 'Choose a role'} />
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
    <FormField htmlFor={id} label="Plant" hint="Leave on the selected plant unless the user works elsewhere.">
      <Select value={value} onValueChange={onChange} disabled={plants.isLoading}>
        <SelectTrigger id={id}>
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
