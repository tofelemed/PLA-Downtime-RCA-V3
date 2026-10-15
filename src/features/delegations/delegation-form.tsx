import { useState } from 'react';
import { useAssignableUsers } from '@/api/v2/queries/administration-users';
import { useCreateDelegation } from '@/api/v2/queries/role-delegations';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { CreateRoleDelegationInput, DelegableRole } from '@/api/v2/types/role-delegations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';
import { useCalendarPreference } from '@/lib/dates';

const DELEGABLE_ROLES: readonly DelegableRole[] = ['manager_approver', 'production_accountant', 'finance_approver', 'quality_approver'];

export interface DelegationFormProps {
  /** a plant administrator records for anyone; a role holder only for themselves */
  isAdmin: boolean;
  userId: string;
  timezone: string;
  onDone: () => void;
}

type Draft = Omit<CreateRoleDelegationInput, 'validFrom' | 'validUntil' | 'scopeKind' | 'scopeId'> & {
  validFrom: string | null;
  validUntil: string | null;
  unitId: string;
};

/** The fields the server requires, before sending (the server checks role, membership and length). */
const missing = (d: Draft) => !d.delegatorId || !d.delegateId || !d.validFrom || !d.validUntil || !d.reason.trim();

/**
 * SME R1 / R6: hand an approval role to a delegate for a limited time (at most 90 days) — plant-wide or for
 * one unit, with the reason. Times in the plant's time zone and calendar.
 */
export function DelegationForm({ isAdmin, userId, timezone, onDone }: DelegationFormProps) {
  const tenantId = useV2TenantId();
  const users = useAssignableUsers();
  const units = useUnits();
  const { calendar } = useCalendarPreference();
  const create = useCreateDelegation();
  const [draft, setDraft] = useState<Draft>({ delegatorId: userId, delegateId: '', role: 'manager_approver', reason: '', validFrom: null, validUntil: null, unitId: '' });
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const people = (users.data?.items ?? []).filter((u) => u.isActive).map((u) => ({ value: u.id, label: u.name }));
  const submit = () => {
    if (missing(draft) || !tenantId) return;
    const scope = draft.unitId ? { scopeKind: 'unit' as const, scopeId: draft.unitId } : { scopeKind: 'tenant' as const, scopeId: tenantId };
    void create
      .submit({
        delegatorId: draft.delegatorId,
        delegateId: draft.delegateId,
        role: draft.role,
        ...scope,
        reason: draft.reason.trim(),
        validFrom: draft.validFrom as string,
        validUntil: draft.validUntil as string,
      })
      .then(onDone)
      .catch(() => undefined);
  };
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm" data-testid="delegation-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="delegator">Hands over</Label>
          <NativeSelect id="delegator" testId="delegation-delegator" value={draft.delegatorId} onChange={(v) => set({ delegatorId: v })} disabled={!isAdmin} options={people} placeholder="Choose a person" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="delegate">To (delegate)</Label>
          <NativeSelect id="delegate" testId="delegation-delegate" value={draft.delegateId} onChange={(v) => set({ delegateId: v })} options={people.filter((p) => p.value !== draft.delegatorId)} placeholder="Choose a person" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="delegation-role">Role</Label>
          <NativeSelect id="delegation-role" testId="delegation-role" value={draft.role} onChange={(v) => set({ role: v as DelegableRole })} options={DELEGABLE_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="delegation-unit">Where</Label>
          <NativeSelect id="delegation-unit" testId="delegation-unit" value={draft.unitId} onChange={(v) => set({ unitId: v })} placeholder="The whole plant" options={flattenPages(units.data?.pages).map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <DateTimeInput label="From" value={draft.validFrom} timeZone={timezone} calendar={calendar} onChange={(v) => set({ validFrom: v })} required />
        <DateTimeInput label="Until (at most 90 days)" value={draft.validUntil} timeZone={timezone} calendar={calendar} onChange={(v) => set({ validUntil: v })} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="delegation-reason">Reason</Label>
        <Input id="delegation-reason" data-testid="delegation-reason" value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
      </div>
      {create.error ? <FriendlyErrorAlert error={create.error} /> : null}
      <Button size="sm" data-testid="delegation-save" disabled={missing(draft) || create.isPending} onClick={submit}>
        Delegate
      </Button>
    </div>
  );
}
