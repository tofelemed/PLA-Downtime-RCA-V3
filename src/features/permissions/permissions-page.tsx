import { SectionPage } from '@/features/admin/shared/section-page';
import { useSearchParams } from 'react-router-dom';
import { useUser, useUsersPage } from '@/api/v2/queries/administration-users';
import type { UserView } from '@/api/v2/types/administration';
import { useAuth } from '@/contexts/AuthContext';
import { PageGate } from '@/features/admin/shared/page-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { roleLabel } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { placeOf } from '@/features/users/components/user-columns';
import { UserActivationButton } from '@/features/users/components/user-activation-button';
import { UserStatusBadge } from '@/features/users/components/user-status-badge';
import { ModulePermissionsPanel } from './module-permissions-panel';

const COLUMNS: ReadonlyArray<DataTableColumn<UserView>> = [
  { id: 'name', header: 'Name', cell: (user) => user.name },
  { id: 'role', header: 'Role', cell: (user) => roleLabel(user.role), nowrap: true },
  { id: 'place', header: 'Plant', cell: placeOf },
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

function PermissionsScreen({ embedded }: { embedded: boolean }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const selectedId = params.get('user');
  const users = useUsersPage({ q: q || undefined });
  const selected = useUser(selectedId);
  const update = (patch: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  return (
    <SectionPage embedded={embedded} title="Permissions" description="See what each user's role reaches and activate or deactivate users.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Users">
          <DebouncedSearchInput label="Search users" value={q} onChange={(text) => update({ q: text || null })} />
          <DataTable
            caption="Users"
            columns={COLUMNS}
            rows={users.rows}
            getRowKey={(user) => user.id}
            pager={users.pager}
            status={users.status}
            onRowClick={(user) => update({ user: user.id })}
            rowLabel={(user) => `Show permissions of ${user.name}`}
          />
        </Section>
        <div className="space-y-6">
          <ModulePermissionsPanel user={selected.data ?? null} />
          {selected.data && <ActivationSection user={selected.data} />}
        </div>
      </div>
    </SectionPage>
  );
}

function ActivationSection({ user }: { user: UserView }) {
  const { session } = useAuth();
  if (!user.manageable || session?.user.id === user.id) return null;
  return (
    <Section title="Status" description={user.isActive ? `${user.name} can sign in.` : `${user.name} cannot sign in.`}>
      <UserActivationButton user={user} />
    </Section>
  );
}
