import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, Tenant, Organization } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Factory, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface TenantFormData {
  name: string;
  code: string;
  description: string;
  organizationId: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
}

const TenantList: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    code: '',
    description: '',
    organizationId: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    timezone: 'UTC',
  });

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    if (!session) return;

    try {
      const [tenantsData, orgsData] = await Promise.all([
        masterDataService.getTenants({}),
        masterDataService.getOrganizations({}),
      ]);
      setTenants(tenantsData);
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenants and organizations',
        variant: 'destructive',
      });
    }
  };

  const getFilteredTenants = () => {
    if (!searchQuery) return tenants;
    
    return tenants.filter(tenant => 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getOrganizationName = (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    return org?.name || 'Unknown Organization';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      organizationId: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
      timezone: 'UTC',
    });
    setEditingTenant(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      code: tenant.code,
      description: tenant.description || '',
      organizationId: tenant.organizationId,
      address: tenant.address || '',
      contactEmail: tenant.contactEmail || '',
      contactPhone: tenant.contactPhone || '',
      timezone: tenant.timezone || 'UTC',
    });
    setShowForm(true);
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!window.confirm(`Are you sure you want to delete "${tenant.name}"?`)) return;

    try {
      await masterDataService.deleteTenant(tenant.id);
      
      toast({
        title: 'Success',
        description: 'Tenant deleted successfully',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tenant',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!session) return;

    try {
      if (editingTenant) {
        // Update existing tenant
        await masterDataService.updateTenant(editingTenant.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description,
          organizationId: formData.organizationId,
          address: formData.address,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          timezone: formData.timezone,
        });
        
        toast({
          title: 'Success',
          description: 'Tenant updated successfully',
        });
      } else {
        // Create new tenant
        await masterDataService.createTenant({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          organizationId: formData.organizationId,
          address: formData.address,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          timezone: formData.timezone,
        });
        
        toast({
          title: 'Success',
          description: 'Tenant created successfully',
        });
      }

      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Failed to save tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tenant',
        variant: 'destructive',
      });
    }
  };

  const renderTenantCard = (tenant: Tenant) => (
    <Card key={tenant.id} className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Factory className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{tenant.name}</CardTitle>
              <CardDescription className="text-sm">
                Code: {tenant.code} • {getOrganizationName(tenant.organizationId)}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tenant.description && (
            <p className="text-sm text-gray-600">{tenant.description}</p>
          )}
          {tenant.address && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Address:</span> {tenant.address}
            </p>
          )}
          {tenant.contactEmail && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Email:</span> {tenant.contactEmail}
            </p>
          )}
          {tenant.contactPhone && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Phone:</span> {tenant.contactPhone}
            </p>
          )}
          <p className="text-xs text-gray-500">
            <span className="font-medium">Timezone:</span> {tenant.timezone || 'UTC'}
          </p>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(tenant)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(tenant)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderForm = () => (
    <Dialog open={showForm} onOpenChange={setShowForm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingTenant ? 'Edit Tenant/Plant' : 'Create Tenant/Plant'}
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
            <Label htmlFor="code">Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="organizationId">Organization *</Label>
            <Select
              value={formData.organizationId}
              onValueChange={(value) => setFormData({ ...formData, organizationId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
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
              {editingTenant ? 'Update' : 'Create'}
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
          <h3 className="text-xl font-semibold">Tenants/Plants</h3>
          <p className="text-sm text-gray-500">
            Manage plant locations and configurations
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant/Plant
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tenants/plants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredTenants().map(renderTenantCard)}
      </div>

      {getFilteredTenants().length === 0 && (
        <div className="text-center py-12">
          <Factory className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No tenants/plants found' : 'No tenants/plants yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first tenant/plant'
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant/Plant
            </Button>
          )}
        </div>
      )}

      {renderForm()}
    </div>
  );
};

export default TenantList; 