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
import { AdminDialog } from '@/features/admin/shared/admin-dialog';
import { NativeSelect, type NativeSelectProps } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';
import { useCalendarPreference } from '@/lib/dates';

const DELEGABLE_ROLES: readonly DelegableRole[] = ['manager_approver', 'production_accountant', 'finance_approver', 'quality_approver', 'metrology_approver'];
const ROLE_OPTIONS = DELEGABLE_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

export interface DelegationFormProps {
  /** a plant administrator records for anyone; a role holder only for themselves */
  isAdmin: boolean;
  userId: string;
  timezone: string;
  /** the info text of the title's ⓘ (what a delegation does) */
  info: string;
  onDone: () => void;
}

type Draft = Omit<CreateRoleDelegationInput, 'validFrom' | 'validUntil' | 'scopeKind' | 'scopeId'> & {
  validFrom: string | null;
  validUntil: string | null;
  unitId: string;
};
type Option = { value: string; label: string };

/** The fields the server requires, before sending (the server checks role, membership and length). */
const missing = (d: Draft) => !d.delegatorId || !d.delegateId || !d.validFrom || !d.validUntil || !d.reason.trim();

function toInput(draft: Draft, tenantId: string): CreateRoleDelegationInput {
  const scope = draft.unitId ? { scopeKind: 'unit' as const, scopeId: draft.unitId } : { scopeKind: 'tenant' as const, scopeId: tenantId };
  return {
    delegatorId: draft.delegatorId,
    delegateId: draft.delegateId,
    role: draft.role,
    ...scope,
    reason: draft.reason.trim(),
    validFrom: draft.validFrom as string,
    validUntil: draft.validUntil as string,
  };
}

/** "Hands over": a plant administrator chooses anyone; a role holder hands over their own role, shown as text. */
function DelegatorField({ isAdmin, value, people, onChange }: { isAdmin: boolean; value: string; people: Option[]; onChange: (v: string) => void }) {
  if (!isAdmin) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Hands over</p>
        <p className="flex h-9 items-center text-sm" data-testid="delegation-delegator-text">{people.find((p) => p.value === value)?.label ?? 'You'}</p>
      </div>
    );
  }
  return <SelectField id="delegator" testId="delegation-delegator" label="Hands over" value={value} onChange={onChange} options={people} placeholder="Choose a person" />;
}

/** A labelled native select of the form (label above, h-9). */
function SelectField({ label, ...select }: NativeSelectProps & { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={select.id}>{label}</Label>
      <NativeSelect {...select} />
    </div>
  );
}

function useDelegationDraft(userId: string) {
  const [draft, setDraft] = useState<Draft>({ delegatorId: userId, delegateId: '', role: 'manager_approver', reason: '', validFrom: null, validUntil: null, unitId: '' });
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  return [draft, set] as const;
}

/**
 * SME R1 / R6: hand an approval role to a delegate for a limited time (at most 90 days) — plant-wide or for
 * one unit, with the reason — in a dialog. Times in the plant's time zone and calendar.
 */
export function DelegationForm({ isAdmin, userId, timezone, info, onDone }: DelegationFormProps) {
  const tenantId = useV2TenantId();
  const users = useAssignableUsers();
  const units = useUnits();
  const { calendar } = useCalendarPreference();
  const create = useCreateDelegation();
  const [draft, set] = useDelegationDraft(userId);
  const people = (users.data?.items ?? []).filter((u) => u.isActive).map((u) => ({ value: u.id, label: u.name }));
  const unitOptions = flattenPages(units.data?.pages).map((u) => ({ value: u.id, label: u.name }));
  const submit = () => {
    if (missing(draft) || !tenantId) return;
    void create.submit(toInput(draft, tenantId)).then(onDone).catch(() => undefined);
  };
  const footer = (
    <>
      <Button variant="outline" className="h-9" onClick={onDone} disabled={create.isPending}>Cancel</Button>
      <Button className="h-9" data-testid="delegation-save" disabled={missing(draft) || create.isPending} onClick={submit}>Delegate</Button>
    </>
  );
  return (
    <AdminDialog open onOpenChange={(open) => !open && onDone()} title="New delegation" info={info} size="lg" footer={footer} testId="delegation-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <DelegatorField isAdmin={isAdmin} value={draft.delegatorId} people={people} onChange={(v) => set({ delegatorId: v })} />
        <SelectField id="delegate" testId="delegation-delegate" label="To (delegate)" value={draft.delegateId} onChange={(v) => set({ delegateId: v })} options={people.filter((p) => p.value !== draft.delegatorId)} placeholder="Choose a person" />
        <SelectField id="delegation-role" testId="delegation-role" label="Role" value={draft.role} onChange={(v) => set({ role: v as DelegableRole })} options={ROLE_OPTIONS} />
        <SelectField id="delegation-unit" testId="delegation-unit" label="Where" value={draft.unitId} onChange={(v) => set({ unitId: v })} placeholder="The whole plant" options={unitOptions} />
        <DateTimeInput compact label="From" value={draft.validFrom} timeZone={timezone} calendar={calendar} onChange={(v) => set({ validFrom: v })} required />
        <DateTimeInput compact label="Until (at most 90 days)" value={draft.validUntil} timeZone={timezone} calendar={calendar} onChange={(v) => set({ validUntil: v })} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="delegation-reason">Reason</Label>
        <Input id="delegation-reason" className="h-9" data-testid="delegation-reason" value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
      </div>
      {create.error ? <FriendlyErrorAlert error={create.error} /> : null}
    </AdminDialog>
  );
}
