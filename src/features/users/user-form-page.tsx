import { useNavigate, useParams } from 'react-router-dom';
import { useCreateUser, useUpdateUser, useUser } from '@/api/v2/queries/administration-users';
import type { UserView } from '@/api/v2/types/administration';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PageGate } from '@/features/admin/shared/page-gate';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { roleLabel } from '@/features/ux-kit/labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { UserAccessSection } from './components/user-access-section';
import { UserDetailsForm } from './components/user-details-form';
import { UserLifecycleActions } from './components/user-lifecycle-actions';
import { UserStatusBadge } from './components/user-status-badge';
import { EMPTY_USER_FORM, formOf, toCreateInput, toUpdateInput, type UserFormValues } from './model/user-form';

const BACK = { to: '/users', label: 'Users' };

/** `/users/new` and `/users/:userId`: a user's details, status and access (was the "Edit User" dialog). */
export function UserFormPage() {
  const { canAdministerTenant } = useCapabilities();
  const { userId } = useParams();
  return (
    <PageGate title="User" allowed={canAdministerTenant} deniedText="You don't have permission to access user management.">
      {userId ? <EditUser id={userId} /> : <NewUser />}
    </PageGate>
  );
}

function NewUser() {
  const navigate = useNavigate();
  const create = useCreateUser();
  const feedback = useCommandFeedback();
  const { isSuperAdmin, roles } = useCapabilities();
  const choosePlant = isSuperAdmin || roles.includes('OrgAdmin');
  const submit = async (values: UserFormValues) => {
    const user = await feedback(() => create.submit(toCreateInput(values)), 'User created');
    navigate(`/users/${user.id}`, { replace: true });
  };
  return (
    <Page>
      <PageHeader title="Add user" back={BACK} description="The user signs in with this e-mail and password. Their role decides what they see." />
      <Section title="Details">
        <UserDetailsForm mode="create" initial={EMPTY_USER_FORM} choosePlant={choosePlant} submitLabel="Create user" onSubmit={submit} onCancel={() => navigate(BACK.to)} />
      </Section>
    </Page>
  );
}

function EditUser({ id }: { id: string }) {
  const user = useUser(id);
  const state = dataStateOf(user);
  if (!user.data) {
    return (
      <Page>
        <PageHeader title="User" back={BACK} />
        <DataState state={state} error={user.error} onRetry={() => void user.refetch()} />
      </Page>
    );
  }
  return <UserDetail user={user.data} />;
}

function UserDetail({ user }: { user: UserView }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const update = useUpdateUser();
  const feedback = useCommandFeedback();
  const isSelf = session?.user.id === user.id;
  const submit = async (values: UserFormValues) => {
    const body = toUpdateInput(values, user);
    if (Object.keys(body).length === 0) return navigate(BACK.to);
    await feedback(() => update.submit({ id: user.id, body }), 'User updated');
  };
  return (
    <Page>
      <PageHeader title={user.name} back={BACK} description={`${roleLabel(user.role)} · ${user.tenantName ?? user.organizationName ?? 'All plants'}`} meta={<UserStatusBadge isActive={user.isActive} />} />
      {!user.manageable && (
        <Alert>
          <StatusIcon.info aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>You can see this user but not change it: it has your rank or a higher one, or it belongs elsewhere.</AlertDescription>
        </Alert>
      )}
      <Section title="Details">
        <UserDetailsForm key={user.updatedAt} mode="edit" initial={formOf(user)} choosePlant={false} readOnly={!user.manageable} submitLabel="Save changes" onSubmit={submit} onCancel={() => navigate(BACK.to)} />
      </Section>
      <UserAccessSection userId={user.id} userName={user.name} canWrite={user.manageable} />
      {user.manageable && (
        <Section title="Status" description="Deactivated users cannot sign in; their history keeps their name.">
          <UserLifecycleActions user={user} isSelf={isSelf} />
        </Section>
      )}
    </Page>
  );
}
