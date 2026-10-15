import { useState } from 'react';
import { useRevokeDelegation, useRoleDelegations } from '@/api/v2/queries/role-delegations';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RoleDelegationView } from '@/api/v2/types/role-delegations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DelegationForm } from './delegation-form';

const SCOPE_LABELS: Readonly<Record<RoleDelegationView['scopeKind'], string>> = { tenant: 'Whole plant', site: 'One site', unit: 'One unit' };

function statusOf(d: RoleDelegationView): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (d.revokedAt) return { label: 'Revoked', variant: 'outline' };
  if (d.inForce) return { label: 'In force', variant: 'default' };
  return { label: new Date(d.validFrom).getTime() > Date.now() ? 'Planned' : 'Ended', variant: 'secondary' };
}

/** End a delegation early with a reason (the delegator, the delegate or a plant administrator). */
function RevokeButton({ delegation }: { delegation: RoleDelegationView }) {
  const revoke = useRevokeDelegation();
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" data-testid="delegation-revoke">
          Revoke…
        </Button>
      }
      title="End this delegation now?"
      description="The delegate loses the role at once; decisions already taken stay recorded."
      confirmLabel="Revoke delegation"
      destructive
      confirmDisabled={!reason.trim()}
      onConfirm={() => revoke.submit({ id: delegation.id, reason: reason.trim() }).then(() => undefined)}
    >
      <Input aria-label="Reason" data-testid="delegation-revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
    </ConfirmDialog>
  );
}

function columns(timezone: string, mayRevoke: (d: RoleDelegationView) => boolean): DataTableColumn<RoleDelegationView>[] {
  return [
    { id: 'role', header: 'Role', cell: (d) => roleLabel(d.role) },
    { id: 'from', header: 'Hands over', cell: (d) => d.delegatorName ?? 'Unknown user' },
    { id: 'to', header: 'Delegate', cell: (d) => d.delegateName ?? 'Unknown user' },
    { id: 'scope', header: 'Where', cell: (d) => SCOPE_LABELS[d.scopeKind] },
    {
      id: 'when',
      header: 'When',
      nowrap: true,
      cell: (d) => (
        <>
          <PlantTime iso={d.validFrom} tz={timezone} withDate /> – <PlantTime iso={d.validUntil} tz={timezone} withDate />
        </>
      ),
    },
    { id: 'reason', header: 'Reason', cell: (d) => d.reason },
    {
      id: 'status',
      header: 'Status',
      cell: (d) => {
        const status = statusOf(d);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    { id: 'actions', header: '', cell: (d) => (mayRevoke(d) ? <RevokeButton delegation={d} /> : null) },
  ];
}

function DelegationsScreen() {
  const { canAdministerTenant, canDelegateApprovals } = useCapabilities();
  const userId = useCurrentUserId();
  const { timezone } = usePlantTimezone();
  const [state, setState] = useState<'in_force' | 'all'>('in_force');
  const [adding, setAdding] = useState(false);
  const list = useRoleDelegations(state);
  const mayRevoke = (d: RoleDelegationView) =>
    !d.revokedAt && new Date(d.validUntil).getTime() > Date.now() && (canAdministerTenant || d.delegatorId === userId || d.delegateId === userId);
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="delegations">
        <PageHeader
          title="Delegations"
          description="Hand an approval role to a delegate for an absence (at most 90 days). The delegate approves like the role holder; separation of duties still applies — nobody approves their own work."
          actions={
            canDelegateApprovals && userId ? (
              <Button size="sm" data-testid="delegation-new" onClick={() => setAdding((v) => !v)}>
                {adding ? 'Close' : 'New delegation'}
              </Button>
            ) : undefined
          }
        />
        {adding && userId && <DelegationForm isAdmin={canAdministerTenant} userId={userId} timezone={timezone} onDone={() => setAdding(false)} />}
        <div className="flex gap-2">
          <Button size="sm" variant={state === 'in_force' ? 'default' : 'outline'} onClick={() => setState('in_force')}>
            In force
          </Button>
          <Button size="sm" variant={state === 'all' ? 'default' : 'outline'} onClick={() => setState('all')}>
            All
          </Button>
        </div>
        <DataTable
          caption="Delegations of approval roles"
          columns={columns(timezone, mayRevoke)}
          rows={list.data?.items ?? []}
          getRowKey={(d) => d.id}
          status={{ isLoading: list.isLoading, isError: list.isError, error: list.error }}
          empty={{ title: 'No delegation', text: state === 'in_force' ? 'Nobody acts as a delegate right now.' : 'No delegation was recorded in this plant.' }}
        />
      </div>
    </Page>
  );
}

/** SME R1 / R6 delegates at `/delegations`: who holds an approval role for whom, until when, and why. */
export function DelegationsPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its delegations." />;
  return <DelegationsScreen />;
}
