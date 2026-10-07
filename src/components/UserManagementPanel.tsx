import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userApi, UserRecord, UserRole } from '../services/api/userApi';
import { auditApi } from '../services/api/auditApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, User as UserIcon, Search, Shield, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const roleColors = {
  SuperAdmin: 'bg-purple-100 text-purple-800',
  OrgAdmin: 'bg-blue-100 text-blue-800',
  TenantAdmin: 'bg-green-100 text-green-800',
  Manager: 'bg-indigo-100 text-indigo-800',
  Analyst: 'bg-yellow-100 text-yellow-800',
  Engineer: 'bg-orange-100 text-orange-800',
  Operator: 'bg-gray-100 text-gray-800',
};

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  department: string;
  isActive: boolean;
}

const UserManagementPanel: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'Operator',
    phone: '',
    department: '',
    isActive: true,
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

  const getFilteredUsers = () => {
    if (!searchQuery) return users;
    
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'Operator',
      phone: '',
      department: '',
      isActive: true,
    });
    setEditingUser(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      department: user.department || '',
      isActive: user.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (user: UserRecord) => {
    if (!window.confirm(`Are you sure you want to delete "${user.name}"?`)) return;

    try {
      await userApi.deleteUser(user.id);
      try {
        if (session) {
          await auditApi.createLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'DELETE_USER',
            entityType: 'USER',
            entityId: user.id,
            details: { name: user.name, email: user.email },
            organizationId: session.organization?.id,
            tenantId: session.tenant?.id,
          });
        }
      } catch (auditError) {
        console.warn('Failed to record audit log for user delete:', auditError);
      }

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

  const handleSave = async () => {
    if (!session) return;

    try {
      if (editingUser) {
        const updatePayload: Partial<UserRecord> & { password?: string } = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          phone: formData.phone || undefined,
          department: formData.department || undefined,
          isActive: formData.isActive,
        };

        if (formData.password) {
          updatePayload.password = formData.password;
        }

        await userApi.updateUser(editingUser.id, updatePayload);
        try {
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
        } catch (auditError) {
          console.warn('Failed to log audit event for user update:', auditError);
        }

        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
      } else {
        await userApi.createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          phone: formData.phone || undefined,
          department: formData.department || undefined,
          organizationId: session.organization?.id,
          tenantId: session.tenant?.id,
          isActive: formData.isActive,
        });

        try {
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
        } catch (auditError) {
          console.warn('Failed to log audit event for user creation:', auditError);
        }

        toast({
          title: 'Success',
          description: 'User created successfully',
        });
      }

      resetForm();
      setShowForm(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      toast({
        title: 'Error',
        description: 'Failed to save user. Please try again.',
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

  const renderUserCard = (user: UserRecord) => (
    <Card key={user.id} className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <UserIcon className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <CardDescription className="text-sm">
                {user.email}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <Badge className={roleColors[user.role]}>
              {user.role}
            </Badge>
            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {user.department && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Department:</span> {user.department}
            </p>
          )}
          {user.phone && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Phone:</span> {user.phone}
            </p>
          )}
          <p className="text-xs text-gray-500">
            <span className="font-medium">Created:</span> {new Date(user.createdAt || Date.now()).toLocaleDateString()}
          </p>
        </div>
        {canManageUser(user) && (
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(user)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(user)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderForm = () => (
    <Dialog open={showForm} onOpenChange={setShowForm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingUser ? 'Edit User' : 'Create User'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">
              {editingUser ? 'Password (leave blank to keep current)' : 'Password *'}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
            />
          </div>
          <div>
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                <SelectItem value="OrgAdmin">Organization Admin</SelectItem>
                <SelectItem value="TenantAdmin">Tenant Admin</SelectItem>
                <SelectItem value="Analyst">Analyst</SelectItem>
                <SelectItem value="Engineer">Engineer</SelectItem>
                <SelectItem value="Operator">Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Production, Maintenance, Quality"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isActive">Active User</Label>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Users & Access Management</h3>
          <p className="text-sm text-gray-500">
            Manage user accounts, roles, and permissions across the organization
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredUsers().map(renderUserCard)}
      </div>

      {getFilteredUsers().length === 0 && (
        <div className="text-center py-12">
          <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No users found' : 'No users yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first user account'
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          )}
        </div>
      )}

      {renderForm()}
    </div>
  );
};

export default UserManagementPanel; 