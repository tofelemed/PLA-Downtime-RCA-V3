import { Link, useNavigate } from 'react-router-dom';
import { useUsersPage, type UserFilters } from '@/api/v2/queries/administration-users';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AdminCard } from '@/features/admin/shared/admin-card';
import { ALL, FilterSelect, optionsOf } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { SectionPage } from '@/features/admin/shared/section-page';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable } from '@/features/ux-kit/data-table';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { LEGACY_ROLE_LABELS } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { GrantByEmailDialog } from './components/grant-by-email-dialog';
import { USER_COLUMNS } from './components/user-columns';

const DEFAULTS = { q: '', role: ALL, status: 'active' } as const;
type UserUrlFilters = Record<keyof typeof DEFAULTS, string>;
const ROLE_OPTIONS = optionsOf(LEGACY_ROLE_LABELS, 'All roles');
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active users' },
  { value: 'inactive', label: 'Deactivated users' },
  { value: ALL, label: 'Active and deactivated' },
];
const USERS_INFO = 'Members of the selected plant. A user granted access from another plant shows a "From <home plant>" badge.';

function toFilters(values: UserUrlFilters): UserFilters {
  return {
    q: values.q || undefined,
    roles: values.role === ALL ? undefined : [values.role],
    isActive: values.status === ALL ? undefined : values.status === 'active',
  };
}

/** Users of the selected plant (owner requirement "v2 only": replaces the v1 User Management page). */
export function UsersPage({ embedded = false }: { embedded?: boolean }) {
  const { canAdministerTenant } = useCapabilities();
  return (
    <PageGate title="Users" allowed={canAdministerTenant} deniedText="You don't have permission to access user management.">
      <UsersScreen embedded={embedded} />
    </PageGate>
  );
}

/** One bottom-aligned row: search, role, status (labels above, h-9). */
function UsersFilterBar({ values, onChange }: { values: UserUrlFilters; onChange: (patch: Partial<UserUrlFilters>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="users-filters">
      <div className={`${FIELD_CLASS} w-full sm:w-72`}>
        <Label htmlFor="users-search">Search</Label>
        <DebouncedSearchInput id="users-search" label="Search users by name or e-mail" className="max-w-none [&_input]:h-9" value={values.q} onChange={(q) => onChange({ q })} />
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="users-role">Role</Label>
        <FilterSelect id="users-role" label="Role filter" className="h-9" value={values.role} options={ROLE_OPTIONS} onChange={(role) => onChange({ role })} />
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="users-status">Status</Label>
        <FilterSelect id="users-status" label="Status filter" className="h-9" value={values.status} options={STATUS_OPTIONS} onChange={(status) => onChange({ status })} />
      </div>
    </div>
  );
}

function UsersScreen({ embedded }: { embedded: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useUrlFilters(DEFAULTS);
  const users = useUsersPage(toFilters(values));
  const actions = (
    <>
      <GrantByEmailDialog />
      <Button asChild className="h-9">
        <Link to="/users/new">
          <ActionIcon.add aria-hidden="true" />
          Add user
        </Link>
      </Button>
    </>
  );
  return (
    <SectionPage embedded={embedded} title="Users">
      <AdminCard title="Users" info={USERS_INFO} actions={actions} testId="users-card">
        <UsersFilterBar values={values} onChange={setValues} />
        <DataTable
          caption="Users"
          columns={USER_COLUMNS}
          rows={users.rows}
          getRowKey={(user) => user.id}
          pager={users.pager}
          status={users.status}
          density="compact"
          empty={{ title: 'No users', text: 'No user matches the filters.' }}
          onRowClick={(user) => navigate(`/users/${user.id}`)}
          rowLabel={(user) => `Open ${user.name}`}
        />
      </AdminCard>
    </SectionPage>
  );
}
