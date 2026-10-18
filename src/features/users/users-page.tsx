import { SectionPage } from '@/features/admin/shared/section-page';
import { Link, useNavigate } from 'react-router-dom';
import { useUsersPage, type UserFilters } from '@/api/v2/queries/administration-users';
import { Button } from '@/components/ui/button';
import { ALL, FilterSelect, optionsOf } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable } from '@/features/ux-kit/data-table';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { LEGACY_ROLE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { GrantByEmailDialog } from './components/grant-by-email-dialog';
import { USER_COLUMNS } from './components/user-columns';

const DEFAULTS = { q: '', role: ALL, status: 'active' } as const;
const ROLE_OPTIONS = optionsOf(LEGACY_ROLE_LABELS, 'All roles');
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active users' },
  { value: 'inactive', label: 'Deactivated users' },
  { value: ALL, label: 'Active and deactivated' },
];

function toFilters(values: Record<keyof typeof DEFAULTS, string>): UserFilters {
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

function UsersScreen({ embedded }: { embedded: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useUrlFilters(DEFAULTS);
  const users = useUsersPage(toFilters(values));
  return (
    <SectionPage embedded={embedded}
        title="Users"
        description="Members of the selected plant: their role, status and access. Users granted access from another plant show their home plant."
        actions={
          <div className="flex flex-wrap gap-2">
            <GrantByEmailDialog />
            <Button asChild>
              <Link to="/users/new">
                <ActionIcon.add aria-hidden="true" />
                Add user
              </Link>
            </Button>
          </div>
        }
      >
      <Section title="Members">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <DebouncedSearchInput label="Search users by name or e-mail" value={values.q} onChange={(q) => setValues({ q })} />
          <FilterSelect label="Role filter" value={values.role} options={ROLE_OPTIONS} onChange={(role) => setValues({ role })} />
          <FilterSelect label="Status filter" value={values.status} options={STATUS_OPTIONS} onChange={(status) => setValues({ status })} />
        </div>
        <DataTable
          caption="Users"
          columns={USER_COLUMNS}
          rows={users.rows}
          getRowKey={(user) => user.id}
          pager={users.pager}
          status={users.status}
          empty={{ title: 'No users', text: 'No user matches the filters.' }}
          onRowClick={(user) => navigate(`/users/${user.id}`)}
          rowLabel={(user) => `Open ${user.name}`}
        />
      </Section>
    </SectionPage>
  );
}
