import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ModulePermissionsPanel } from '@/features/permissions/module-permissions-panel';
import { masterDataService, Organization, Tenant } from '../services/MasterDataService';
import { userApi, UserRecord } from '../services/api/userApi';
import { auditApi } from '../services/api/auditApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User as UserIcon, Lock, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';

const log = createLogger('PermissionsManagement');

/**
 * Users of the administrator's scope with the modules their role reaches (read-only matrix, see
 * `features/permissions`). The only write here is the active/inactive toggle, which `PUT /users/:id` stores.
 */
export const PermissionsManagement: React.FC = () => {
  const { session } = useAuth();
  const { canAdministerTenant } = useCapabilities();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    if (!session) return;
    try {
      const [usersData, orgsData, tenantsData] = await Promise.all([
        userApi.getUsers(),
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
      ]);
      setUsers(visibleUsers(usersData, session));
      setOrganizations(orgsData);
      setTenants(tenantsData);
    } catch (error: unknown) {
      log.error('Failed to load permissions data', error);
      toast({ title: 'Error', description: 'Failed to load permissions data', variant: 'destructive' });
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await userApi.updateUser(userId, { isActive });
      await auditApi.createLog({
        userId: session!.user.id,
        userName: session!.user.name || session!.user.email,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entityType: 'USER',
        entityId: userId,
        details: {},
        organizationId: session!.user.organizationId || session!.organization?.id || '',
        tenantId: session!.user.tenantId || session!.tenant?.id || '',
      });
      toast({ title: 'Success', description: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
      loadData();
    } catch (error: unknown) {
      log.error('Failed to toggle user status', error);
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' });
    }
  };

  if (!session || !canAdministerTenant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You don't have permission to manage user permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Permissions Management</h2>
        <p className="text-muted-foreground">See what each user's role reaches and activate or deactivate users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              Users
            </CardTitle>
            <CardDescription>Select a user to see their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  selected={selectedUser?.id === user.id}
                  place={placeOf(user, organizations, tenants)}
                  manageable={canManageUser(user, session)}
                  onSelect={() => setSelectedUser(user)}
                  onToggleStatus={() => handleToggleUserStatus(user.id, !user.isActive)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <ModulePermissionsPanel user={selectedUser} />
      </div>
    </div>
  );
};

type Session = NonNullable<ReturnType<typeof useAuth>['session']>;

/** TenantAdmin: the plant's users; OrgAdmin: the organisation's; SuperAdmin: everyone. */
function visibleUsers(all: UserRecord[], session: Session): UserRecord[] {
  if (session.user.role === 'TenantAdmin') return all.filter((user) => user.tenantId === session.tenant?.id);
  if (session.user.role === 'OrgAdmin') {
    return all.filter(
      (user) =>
        user.organizationId === session.organization?.id ||
        (!user.organizationId && user.tenantId === session.tenant?.id),
    );
  }
  return all;
}

function canManageUser(user: UserRecord, session: Session): boolean {
  if (session.user.role === 'SuperAdmin') return true;
  if (session.user.role === 'OrgAdmin') return user.organizationId === session.organization?.id;
  if (session.user.role === 'TenantAdmin') return user.tenantId === session.tenant?.id;
  return false;
}

function placeOf(user: UserRecord, organizations: Organization[], tenants: Tenant[]): string {
  const org = organizations.find((candidate) => candidate.id === user.organizationId)?.name ?? '';
  const tenant = tenants.find((candidate) => candidate.id === user.tenantId)?.name;
  return tenant ? `${org} • ${tenant}` : org;
}

interface UserRowProps {
  user: UserRecord;
  selected: boolean;
  place: string;
  manageable: boolean;
  onSelect: () => void;
  onToggleStatus: () => void;
}

function UserRow({ user, selected, place, manageable, onSelect, onToggleStatus }: UserRowProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selected ? 'border-blue-500 bg-blue-50' : ''}`}
      onClick={onSelect}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{user.name}</p>
          <Badge variant={user.isActive ? 'default' : 'destructive'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
        <p className="text-sm text-gray-500">{user.email}</p>
        <p className="text-xs text-gray-400">
          {user.role} • {place}
        </p>
      </div>
      {manageable && (
        <Button
          variant="ghost"
          size="sm"
          title={user.isActive ? 'Deactivate user' : 'Activate user'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus();
          }}
        >
          {user.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </Button>
      )}
    </div>
  );
}
