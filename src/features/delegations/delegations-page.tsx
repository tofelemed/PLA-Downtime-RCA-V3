import { useRef, useState } from 'react';
import { useRevokeDelegation, useRoleDelegations } from '@/api/v2/queries/role-delegations';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RoleDelegationView } from '@/api/v2/types/role-delegations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminCard } from '@/features/admin/shared/admin-card';
import { SectionPage } from '@/features/admin/shared/section-page';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { resolvedActorText } from '@/features/ux-kit/labels/actor-labels';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DelegationForm } from './delegation-form';
import { delegationsDescription } from './delegations-description';

const SCOPE_LABELS: Readonly<Record<RoleDelegationView['scopeKind'], string>> = { tenant: 'Whole plant', site: 'One site', unit: 'One unit' };
type ListState = 'in_force' | 'all';

function statusOf(d: RoleDelegationView): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (d.revokedAt) return { label: 'Revoked', variant: 'outline' };
  if (d.inForce) return { label: 'In force', variant: 'default' };
  return { label: new Date(d.validFrom).getTime() > Date.now() ? 'Planned' : 'Ended', variant: 'secondary' };
}

/** End a delegation early with a reason (the delegator, the delegate or a plant administrator). */
function RevokeButton({ delegation }: { delegation: RoleDelegationView }) {
  const revoke = useRevokeDelegation();
  const [reason, setReason] = useState('');
  const field = useRef<HTMLInputElement>(null);
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" className="whitespace-nowrap" data-testid="delegation-revoke">
          Revoke…
        </Button>
      }
      title="End this delegation now?"
      description="The delegate loses the role at once; decisions already taken stay recorded."
      confirmLabel="Revoke delegation"
      destructive
      initialFocus={field}
      confirmDisabled={!reason.trim()}
      confirmDisabledReason="Enter the reason."
      onConfirm={() => revoke.submit({ id: delegation.id, reason: reason.trim() }).then(() => undefined)}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`revoke-reason-${delegation.id}`}>Reason</Label>
        <Input ref={field} id={`revoke-reason-${delegation.id}`} className="h-9" data-testid="delegation-revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </ConfirmDialog>
  );
}

function columns(timezone: string, mayRevoke: (d: RoleDelegationView) => boolean): DataTableColumn<RoleDelegationView>[] {
  return [
    { id: 'role', header: 'Role', cell: (d) => roleLabel(d.role) },
    { id: 'from', header: 'Hands over', cell: (d) => resolvedActorText(d.delegatorId, d.delegatorName) },
    { id: 'to', header: 'Delegate', cell: (d) => resolvedActorText(d.delegateId, d.delegateName) },
    { id: 'scope', header: 'Where', cell: (d) => SCOPE_LABELS[d.scopeKind], nowrap: true },
    {
      id: 'when',
      header: 'When',
      nowrap: true,
      cell: (d) => (
        <>
          <PlantTime iso={d.validFrom} tz={timezone} withDate withZone={false} /> – <PlantTime iso={d.validUntil} tz={timezone} withDate withZone={false} />
        </>
      ),
    },
    { id: 'reason', header: 'Reason', cell: (d) => d.reason },
    {
      id: 'status',
      header: 'Status',
      nowrap: true,
      cell: (d) => {
        const status = statusOf(d);
        return <Badge variant={status.variant} className="whitespace-nowrap">{status.label}</Badge>;
      },
    },
    { id: 'actions', header: <span className="sr-only">Actions</span>, headerLabel: 'Actions', nowrap: true, cell: (d) => (mayRevoke(d) ? <RevokeButton delegation={d} /> : null) },
  ];
}

/** "Show": the delegations in force now, or all of them (two h-9 buttons, label above). */
function StateFilter({ value, onChange }: { value: ListState; onChange: (next: ListState) => void }) {
  return (
    <div className={FIELD_CLASS}>
      <span className="text-sm font-medium" id="delegations-show">Show</span>
      <div className="flex gap-2" role="group" aria-labelledby="delegations-show">
        <Button className="h-9" variant={value === 'in_force' ? 'default' : 'outline'} aria-pressed={value === 'in_force'} onClick={() => onChange('in_force')}>
          In force
        </Button>
        <Button className="h-9" variant={value === 'all' ? 'default' : 'outline'} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          All
        </Button>
      </div>
    </div>
  );
}

function DelegationsScreen({ embedded }: { embedded: boolean }) {
  const { canAdministerTenant, canDelegateApprovals, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const { timezone } = usePlantTimezone();
  const [state, setState] = useState<ListState>('in_force');
  const [adding, setAdding] = useState(false);
  const list = useRoleDelegations(state);
  const info = delegationsDescription(isSuperAdmin);
  const mayRevoke = (d: RoleDelegationView) =>
    !d.revokedAt && new Date(d.validUntil).getTime() > Date.now() && (canAdministerTenant || d.delegatorId === userId || d.delegateId === userId);
  const action = canDelegateApprovals && userId ? <Button className="h-9" data-testid="delegation-new" onClick={() => setAdding(true)}>New delegation</Button> : undefined;
  return (
    <div data-testid="delegations">
      <SectionPage embedded={embedded} title="Approval delegations">
        <AdminCard title="Approval delegations" info={info} count={list.data?.items.length} actions={action}>
          <StateFilter value={state} onChange={setState} />
          <DataTable
            caption="Delegations of approval roles"
            columns={columns(timezone, mayRevoke)}
            rows={list.data?.items ?? []}
            getRowKey={(d) => d.id}
            status={{ isLoading: list.isLoading, isError: list.isError, error: list.error }}
            density="compact"
            empty={{ title: 'No delegation', text: state === 'in_force' ? 'Nobody acts as a delegate right now.' : 'No delegation was recorded in this plant.' }}
          />
        </AdminCard>
      </SectionPage>
      {adding && userId && <DelegationForm isAdmin={canAdministerTenant} userId={userId} timezone={timezone} info={info} onDone={() => setAdding(false)} />}
    </div>
  );
}

/** SME R1 / R6 delegates at `/delegations`: who holds an approval role for whom, until when, and why. */
export function DelegationsPage({ embedded = false }: { embedded?: boolean }) {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its delegations." />;
  return <DelegationsScreen embedded={embedded} />;
}
