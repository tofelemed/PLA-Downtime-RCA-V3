import { useId, useMemo } from 'react';
import { useGrantableRoles } from '@/api/v2/queries/administration-users';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/features/admin/shared/form-field';
import { roleLabel } from '@/features/ux-kit/labels';
import { WHOLE_PLANT, type ScopeChoice } from '../model/scope-choice';

/** Role (at most the caller's rank) and place (the whole plant or one unit) of a grant: two selects. */
export function GrantScopeFields({ value, onChange }: { value: ScopeChoice; onChange: (next: ScopeChoice) => void }) {
  const ids = { role: useId(), where: useId() };
  const grantable = useGrantableRoles();
  const units = useUnits();
  const unitList = useMemo(() => flattenPages(units.data?.pages), [units.data]);
  return (
    <>
      <FormField htmlFor={ids.role} label="Role" required>
        <Select value={value.role} onValueChange={(role) => onChange({ ...value, role })}>
          <SelectTrigger id={ids.role} className="h-9">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            {(grantable.data?.scopeRoles ?? []).map((scopeRole) => (
              <SelectItem key={scopeRole} value={scopeRole}>
                {roleLabel(scopeRole)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor={ids.where} label="Where">
        <Select value={value.where} onValueChange={(where) => onChange({ ...value, where })}>
          <SelectTrigger id={ids.where} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WHOLE_PLANT}>The whole plant</SelectItem>
            {unitList.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                Only {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </>
  );
}
