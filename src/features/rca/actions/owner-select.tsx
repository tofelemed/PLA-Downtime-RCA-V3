import { FormField } from '@/features/ux-kit/form-field';
import { useUserNames } from '@/features/ux-kit/labels';
import { useAssignableUsers } from '../use-assignable-users';

export interface OwnerSelectProps {
  id: string;
  value: string;
  onChange: (ownerId: string) => void;
  label?: string;
  /** text of the empty choice */
  noneLabel?: string;
}

/**
 * Owner of an action: the active members of the plant (`GET /v2/users/directory`). A current owner who
 * is no longer in the directory stays selectable by name, so editing never drops them silently.
 */
export function OwnerSelect({ id, value, onChange, label = 'Owner', noneLabel = 'No owner' }: OwnerSelectProps) {
  const { users, isLoading } = useAssignableUsers();
  const names = useUserNames(value ? [value] : []);
  const listed = users.some((user) => user.id === value);
  return (
    <FormField id={id} label={label} hint={isLoading ? 'Loading the plant members…' : undefined}>
      <select id={id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{noneLabel}</option>
        {value && !listed && <option value={value}>{names.nameOf(value)}</option>}
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}
