import { useSearchParams } from 'react-router-dom';
import { useUser, useUsersPage } from '@/api/v2/queries/administration-users';
import type { UserView } from '@/api/v2/types/administration';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { AdminCard } from '@/features/admin/shared/admin-card';
import { PageGate } from '@/features/admin/shared/page-gate';
import { SectionPage } from '@/features/admin/shared/section-page';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { plantRolesText } from '@/features/users/components/user-columns';
import { UserActivationButton } from '@/features/users/components/user-activation-button';
import { UserStatusBadge } from '@/features/users/components/user-status-badge';
import { ModulePermissionsPanel } from './module-permissions-panel';

/** Name, plant roles, status: no plant column, it repeats the selected plant on every row (cleanup 25 Oct 2026). */
const COLUMNS: ReadonlyArray<DataTableColumn<UserView>> = [
  { id: 'name', header: 'Name', cell: (user) => user.name },
  // QA re-test 2026-10-19: the plant roles that decide the menu, not the legacy sign-in type
  { id: 'role', header: 'Plant roles', cell: plantRolesText },
  { id: 'status', header: 'Status', cell: (user) => <UserStatusBadge isActive={user.isActive} />, nowrap: true },
];

/** Users with the modules their role reaches, and activation (owner requirement "v2 only"). */
export function PermissionsPage({ embedded = false }: { embedded?: boolean }) {
  const { canAdministerTenant } = useCapabilities();
  return (
    <PageGate title="Permissions" allowed={canAdministerTenant} deniedText="You don't have permission to manage user permissions.">
      <PermissionsScreen embedded={embedded} />
    </PageGate>
  );
}

function useParamPatch() {
  const [params, setParams] = useSearchParams();
  const update = (patch: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  return [params, update] as const;
}

function PermissionsScreen({ embedded }: { embedded: boolean }) {
  const [params, update] = useParamPatch();
  const q = params.get('q') ?? '';
  const users = useUsersPage({ q: q || undefined });
  const selected = useUser(params.get('user'));
  return (
    <SectionPage embedded={embedded} title="Permissions">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AdminCard title="Users" info="Choose a user to see the pages their plant roles reach, and activate or deactivate them.">
          <div className={`${FIELD_CLASS} w-full sm:w-72`}>
            <Label htmlFor="permissions-search">Search</Label>
            <DebouncedSearchInput id="permissions-search" label="Search users" className="max-w-none [&_input]:h-9" value={q} onChange={(text) => update({ q: text || null })} />
          </div>
          <DataTable
            caption="Users"
            columns={COLUMNS}
            rows={users.rows}
            getRowKey={(user) => user.id}
            pager={users.pager}
            status={users.status}
            density="compact"
            empty={{ title: 'No users', text: 'No user matches the search.' }}
            onRowClick={(user) => update({ user: user.id })}
            rowLabel={(user) => `Show permissions of ${user.name}`}
          />
        </AdminCard>
        <div className="space-y-4">
          <ModulePermissionsPanel user={selected.data ?? null} />
          {selected.data && <ActivationCard user={selected.data} />}
        </div>
      </div>
    </SectionPage>
  );
}

function ActivationCard({ user }: { user: UserView }) {
  const { session } = useAuth();
  if (!user.manageable || session?.user.id === user.id) return null;
  return (
    <AdminCard title="Status" actions={<UserActivationButton user={user} />}>
      <p className="text-sm">{user.isActive ? `${user.name} can sign in.` : `${user.name} cannot sign in.`}</p>
    </AdminCard>
  );
}
