
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { userApi, UserRecord, UserRole, CreateUserPayload } from '../services/api/userApi';
import { auditApi } from '../services/api/auditApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const roleColors: Record<UserRole, string> = {
  SuperAdmin: 'bg-purple-100 text-purple-800',
  OrgAdmin: 'bg-blue-100 text-blue-800',
  TenantAdmin: 'bg-green-100 text-green-800',
  Manager: 'bg-indigo-100 text-indigo-800',
  Analyst: 'bg-yellow-100 text-yellow-800',
  Engineer: 'bg-orange-100 text-orange-800',
  Operator: 'bg-gray-100 text-gray-800',
};

export const UserManagement: React.FC = () => {
  const { session } = useAuth();
  const { canAdministerTenant } = useCapabilities();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Operator' as UserRole,
  });

  useEffect(() => {
    loadUsers();
  }, [session]);

  const loadUsers = async () => {
    if (!session) return;

    const filters: { tenantId?: string; organizationId?: string } = {};

    if (session.user.role === 'TenantAdmin' && session.tenant?.id) {
      filters.tenantId = session.tenant.id;
    } else if (session.user.role === 'OrgAdmin' && session.organization?.id) {
      filters.organizationId = session.organization.id;
    }

    try {
      const apiUsers = await userApi.getUsers(Object.keys(filters).length ? filters : undefined);
      setUsers(apiUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive',
      });
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    try {
      if (editingUser) {
        // Build update payload - only include defined fields
        const updatePayload: Partial<UserRecord> & { password?: string } = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password && formData.password.trim()) {
          updatePayload.password = formData.password;
        }
        await userApi.updateUser(editingUser.id, updatePayload);
        await auditApi.createLog({
          userId: session.user.id,
          userName: session.user.name,
          action: 'UPDATE_USER',
          entityType: 'USER',
          entityId: editingUser.id,
          details: updatePayload,
          organizationId: session.organization?.id,
          tenantId: session.tenant?.id,
        });
        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
      } else {
        if (!formData.password) {
          toast({
            title: 'Password required',
            description: 'Please provide a password when creating a user.',
            variant: 'destructive',
          });
          return;
        }

        // Build payload - SuperAdmin may not have org/tenant, so only include if present
        const createPayload: CreateUserPayload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          isActive: true,
        };
        
        // Only include organizationId/tenantId if they exist (SuperAdmin may not have them)
        if (session.organization?.id) {
          createPayload.organizationId = session.organization.id;
        }
        if (session.tenant?.id) {
          createPayload.tenantId = session.tenant.id;
        }
        
        await userApi.createUser(createPayload);
        await auditApi.createLog({
          userId: session.user.id,
          userName: session.user.name,
          action: 'CREATE_USER',
          entityType: 'USER',
          entityId: 'new',
          details: { name: formData.name, email: formData.email, role: formData.role },
          organizationId: session.organization?.id,
          tenantId: session.tenant?.id,
        });
        toast({
          title: 'Success',
          description: 'User created successfully',
        });
      }

      setFormData({ name: '', email: '', password: '', role: 'Operator' });
      setIsCreateDialogOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      
      // Extract error message from API error response
      let errorMessage = 'Failed to save user. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.body?.message) {
        // Handle validation errors from backend
        if (Array.isArray(error.body.message)) {
          errorMessage = error.body.message.join(', ');
        } else {
          errorMessage = error.body.message;
        }
      } else if (error?.body?.error) {
        errorMessage = error.body.error;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    if (!session) return;

    try {
      await userApi.deleteUser(userId);
      await auditApi.createLog({
        userId: session.user.id,
        userName: session.user.name,
        action: 'DELETE_USER',
        entityType: 'USER',
        entityId: userId,
        details: { id: userId },
        organizationId: session.organization?.id,
        tenantId: session.tenant?.id,
      });

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user. Please try again.',
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

  if (!session || !canAdministerTenant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You don't have permission to access user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage users and their access permissions
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingUser(null);
              setFormData({ name: '', email: '', password: '', role: 'Operator' });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Engineer">Engineer</SelectItem>
                    <SelectItem value="Analyst">Analyst</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    {['SuperAdmin', 'OrgAdmin'].includes(session.user.role) && (
                      <SelectItem value="TenantAdmin">Tenant Admin</SelectItem>
                    )}
                    {session.user.role === 'SuperAdmin' && (
                      <>
                        <SelectItem value="OrgAdmin">Organization Admin</SelectItem>
                        <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.length} users in your scope
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <Badge className={roleColors[user.role]}>
                    {user.role}
                  </Badge>
                  {!user.isActive && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
                
                {canManageUser(user) && (
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
