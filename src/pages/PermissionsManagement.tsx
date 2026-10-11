
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, Organization, Tenant } from '../services/MasterDataService';
import { userApi, UserRecord, UserRole } from '../services/api/userApi';
import { auditApi } from '../services/api/auditApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, User as UserIcon, Lock, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserPermission {
  userId: string;
  module: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

interface ModulePermissions {
  dashboard: boolean;
  events: boolean;
  rca: boolean;
  masterData: boolean;
  users: boolean;
  connectivity: boolean;
  audit: boolean;
  settings: boolean;
}

// Manager has no defaults: selecting a Manager starts from an empty permission set.
const DEFAULT_ROLE_PERMISSIONS: Partial<Record<UserRole, ModulePermissions>> = {
  SuperAdmin: {
    dashboard: true,
    events: true,
    rca: true,
    masterData: true,
    users: true,
    connectivity: true,
    audit: true,
    settings: true,
  },
  OrgAdmin: {
    dashboard: true,
    events: true,
    rca: true,
    masterData: true,
    users: true,
    connectivity: true,
    audit: true,
    settings: true,
  },
  TenantAdmin: {
    dashboard: true,
    events: true,
    rca: true,
    masterData: true,
    users: true,
    connectivity: true,
    audit: false,
    settings: true,
  },
  Analyst: {
    dashboard: true,
    events: true,
    rca: true,
    masterData: false,
    users: false,
    connectivity: false,
    audit: false,
    settings: false,
  },
  Engineer: {
    dashboard: true,
    events: true,
    rca: true,
    masterData: false,
    users: false,
    connectivity: false,
    audit: false,
    settings: false,
  },
  Operator: {
    dashboard: true,
    events: true,
    rca: false,
    masterData: false,
    users: false,
    connectivity: false,
    audit: false,
    settings: false,
  },
};

export const PermissionsManagement: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userPermissions, setUserPermissions] = useState<ModulePermissions | null>(null);

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

      let filteredUsers = usersData;
      if (session.user.role === 'TenantAdmin') {
        filteredUsers = filteredUsers.filter((user) => user.tenantId === session.tenant?.id);
      } else if (session.user.role === 'OrgAdmin') {
        filteredUsers = filteredUsers.filter(
          (user) =>
            user.organizationId === session.organization?.id ||
            (!user.organizationId && user.tenantId === session.tenant?.id),
        );
      }

      setUsers(filteredUsers);
      setOrganizations(orgsData);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load permissions data',
        variant: 'destructive',
      });
    }
  };

  const handleUserSelect = (user: UserRecord) => {
    setSelectedUser(user);
    // Load user's current permissions (or use role defaults)
    const permissions = { ...DEFAULT_ROLE_PERMISSIONS[user.role] };
    setUserPermissions(permissions);
  };

  const handlePermissionChange = (module: keyof ModulePermissions, value: boolean) => {
    if (!userPermissions) return;
    
    setUserPermissions({
      ...userPermissions,
      [module]: value,
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUser || !userPermissions) return;

    try {
      await auditApi.createLog({
        userId: session!.user.id,
        userName: session!.user.name || session!.user.email,
        action: 'UPDATE_PERMISSIONS',
        entityType: 'USER',
        entityId: selectedUser.id,
        details: { permissions: userPermissions },
        organizationId: session!.user.organizationId || session!.organization?.id || '',
        tenantId: session!.user.tenantId || session!.tenant?.id || '',
      });

      toast({
        title: 'Success',
        description: 'User permissions updated successfully',
      });
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to save permissions',
        variant: 'destructive',
      });
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

      toast({
        title: 'Success',
        description: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const canManageUser = (user: UserRecord) => {
    if (!session) return false;
    
    // SuperAdmin can manage all users
    if (session.user.role === 'SuperAdmin') return true;
    
    // OrgAdmin can manage users in their organization
    if (session.user.role === 'OrgAdmin' && user.organizationId === session.organization?.id) return true;
    
    // TenantAdmin can manage users in their tenant
    if (session.user.role === 'TenantAdmin' && user.tenantId === session.tenant?.id) return true;
    
    return false;
  };

  if (!session || !['SuperAdmin', 'OrgAdmin', 'TenantAdmin'].includes(session.user.role)) {
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
        <p className="text-muted-foreground">
          Manage user access controls and permissions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              Users
            </CardTitle>
            <CardDescription>
              Select a user to manage their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => {
                const org = organizations.find(o => o.id === user.organizationId);
                const tenant = tenants.find(t => t.id === user.tenantId);
                
                return (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.name}</p>
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">
                        {user.role} • {org?.name} {tenant && `• ${tenant.name}`}
                      </p>
                    </div>
                    
                    {canManageUser(user) && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleUserStatus(user.id, !user.isActive);
                          }}
                        >
                          {user.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Permissions Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Module Permissions
            </CardTitle>
            <CardDescription>
              {selectedUser ? `Managing permissions for ${selectedUser.name}` : 'Select a user to manage permissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedUser && userPermissions ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-gray-500">Role: {selectedUser.role}</p>
                </div>

                <div className="space-y-3">
                  {Object.entries(userPermissions).map(([module, hasAccess]) => (
                    <div key={module} className="flex items-center justify-between">
                      <Label htmlFor={module} className="capitalize">
                        {module === 'masterData' ? 'Master Data' : 
                         module === 'rca' ? 'RCA Analysis' : module}
                      </Label>
                      <Switch
                        id={module}
                        checked={hasAccess}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(module as keyof ModulePermissions, checked)
                        }
                        disabled={!canManageUser(selectedUser)}
                      />
                    </div>
                  ))}
                </div>

                {canManageUser(selectedUser) && (
                  <div className="pt-4 border-t">
                    <Button onClick={handleSavePermissions} className="w-full">
                      Save Permissions
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a user to manage their permissions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
