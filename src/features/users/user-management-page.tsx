import { lazy, Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageGate } from '@/features/admin/shared/page-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { UsersPage } from './users-page';

const Permissions = lazy(() => import('@/features/permissions/permissions-page').then((m) => ({ default: m.PermissionsPage })));
const Delegations = lazy(() => import('@/features/delegations/delegations-page').then((m) => ({ default: m.DelegationsPage })));

/** One workspace for membership, effective permissions and temporary approval-role access. */
export function UserManagementPage() {
  const { canUseUserManagement, canDelegateApprovals } = useCapabilities();
  const [params, setParams] = useSearchParams();
  // QA re-test 2026-10-19: an approval-role holder who is not an administrator has only their delegations
  if (!canUseUserManagement && canDelegateApprovals) return <Navigate replace to="/delegations" />;
  const tabs = canUseUserManagement
    ? [{ value: 'users', label: 'Users' }, { value: 'permissions', label: 'Permissions' }, { value: 'delegations', label: 'Delegations' }]
    : [];
  const active = tabs.find((t) => t.value === params.get('tab'))?.value ?? tabs[0]?.value ?? 'users';
  const select = (tab: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (tab === 'users') next.delete('tab'); else next.set('tab', tab);
    return next;
  });
  return <PageGate title="User management" allowed={tabs.length > 0} deniedText="You do not have permission to manage users or approval delegations.">
    <Page width="wide">
      <PageHeader title="User management" description="Manage plant members, their permissions and approval delegations in one place." />
      <Tabs value={active} onValueChange={select}>
        <TabsList className="h-auto flex-wrap">{tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}</TabsList>
        <TabsContent value={active} className="mt-5">
          <Suspense fallback={<DataState state="loading" />}>
            {active === 'users' ? <UsersPage embedded /> : active === 'permissions' ? <Permissions embedded /> : <Delegations embedded />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </Page>
  </PageGate>;
}
