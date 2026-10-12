import { useRevokeScope, useUserScopes } from '@/api/v2/queries/administration-users';
import type { UserScopeView } from '@/api/v2/types/administration';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { IconButton } from '@/features/ux-kit/icon-button';
import { labelOf, roleLabel, SCOPE_KIND_LABELS, SCOPE_LOCK_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ActionIcon } from '@/lib/icons';
import { GrantScopeDialog } from './grant-scope-dialog';

function RevokeCell({ scope, userName, canWrite }: { scope: UserScopeView; userName: string; canWrite: boolean }) {
  const revoke = useRevokeScope();
  const feedback = useCommandFeedback();
  if (scope.lock) return <span className="text-xs text-muted-foreground">{labelOf(SCOPE_LOCK_LABELS, scope.lock)}</span>;
  if (!canWrite) return null;
  return (
    <ConfirmDialog
      trigger={<IconButton icon={ActionIcon.remove} label={`Remove ${roleLabel(scope.role)} access`} />}
      title={`Remove ${roleLabel(scope.role)} access from ${userName}?`}
      description="The user loses this role here at once. The change is recorded in the audit log."
      confirmLabel="Remove access"
      destructive
      onConfirm={() => feedback(() => revoke.submit(scope.id), 'Access removed')}
    />
  );
}

function useColumns(userName: string, canWrite: boolean): ReadonlyArray<DataTableColumn<UserScopeView>> {
  const { timezone } = usePlantTimezone();
  return [
    { id: 'role', header: 'Role', cell: (scope) => roleLabel(scope.role) },
    {
      id: 'where',
      header: 'Where',
      cell: (scope) => (scope.scopeKind === 'tenant' ? labelOf(SCOPE_KIND_LABELS, 'tenant') : scope.scopeName ?? labelOf(SCOPE_KIND_LABELS, scope.scopeKind)),
    },
    { id: 'by', header: 'Granted by', cell: (scope) => scope.createdByName ?? '—' },
    { id: 'on', header: 'Granted on', cell: (scope) => <PlantTime iso={scope.createdAt} tz={timezone} withDate />, nowrap: true },
    { id: 'revoke', header: <span className="sr-only">Remove</span>, headerLabel: 'Remove', cell: (scope) => <RevokeCell scope={scope} userName={userName} canWrite={canWrite} /> },
  ];
}

/**
 * The user's roles in this plant (persona gap "no scope-grant screen"): the role it has from its user
 * record and the extra grants (viewer, reliability engineer, integration or master-data administrator…).
 */
export function UserAccessSection({ userId, userName, canWrite }: { userId: string; userName: string; canWrite: boolean }) {
  const scopes = useUserScopes(userId);
  const columns = useColumns(userName, canWrite);
  return (
    <Section
      title="Access in this plant"
      description="Roles the user holds here, for the whole plant or one unit. You can grant roles up to your own; nobody changes their own access."
      actions={canWrite ? <GrantScopeDialog userId={userId} userName={userName} /> : undefined}
    >
      <DataTable
        caption={`Access of ${userName}`}
        columns={columns}
        rows={scopes.rows}
        getRowKey={(scope) => scope.id}
        pager={scopes.pager}
        status={scopes.status}
        empty={{ title: 'No access here', text: 'The user holds no role in this plant yet.' }}
      />
    </Section>
  );
}
