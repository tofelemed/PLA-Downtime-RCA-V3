import { useId, useMemo, useState } from 'react';
import { useGrantableRoles, useGrantScope } from '@/api/v2/queries/administration-users';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ScopeRole } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/features/admin/shared/form-field';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { roleLabel } from '@/features/ux-kit/labels';
import { ActionIcon, StatusIcon } from '@/lib/icons';

const WHOLE_PLANT = 'plant';

/** Grant a scope role (viewer, reliability engineer, …) in the whole plant or one unit: two fields. */
export function GrantScopeDialog({ userId, userName }: { userId: string; userName: string }) {
  const ids = { role: useId(), where: useId() };
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('');
  const [where, setWhere] = useState(WHOLE_PLANT);
  const grantable = useGrantableRoles();
  const units = useUnits();
  const unitList = useMemo(() => flattenPages(units.data?.pages), [units.data]);
  const grant = useGrantScope();
  const feedback = useCommandFeedback();

  const submit = async () => {
    const input = { userId, role: role as ScopeRole, ...(where === WHOLE_PLANT ? {} : { unitId: where }) };
    try {
      await feedback(() => grant.submit(input), 'Access granted');
      setOpen(false);
      setRole('');
      setWhere(WHOLE_PLANT);
    } catch {
      // the toast explains the refusal; the dialog stays open
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ActionIcon.add aria-hidden="true" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grant access to {userName}</DialogTitle>
          <DialogDescription>The role applies in this plant, or only in one of its units. The change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField htmlFor={ids.role} label="Role" required>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id={ids.role}>
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
            <Select value={where} onValueChange={setWhere}>
              <SelectTrigger id={ids.where}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={grant.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!role || grant.isPending} aria-busy={grant.isPending || undefined}>
            {grant.isPending && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
