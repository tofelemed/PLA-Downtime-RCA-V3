import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, Organization } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Building2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface OrganizationFormData {
  name: string;
  code: string;
  description: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
}

const OrganizationList: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    code: '',
    description: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, [session]);

  const loadOrganizations = async () => {
    if (!session) return;

    try {
      const orgs = await masterDataService.getOrganizations({});
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      });
    }
  };

  const getFilteredOrganizations = () => {
    if (!searchQuery) return organizations;
    
    return organizations.filter(org => 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
    });
    setEditingOrg(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      code: org.code,
      description: org.description || '',
      address: org.address || '',
      contactEmail: org.contactEmail || '',
      contactPhone: org.contactPhone || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (org: Organization) => {
    if (!window.confirm(`Are you sure you want to delete "${org.name}"?`)) return;

    try {
      await masterDataService.deleteOrganization(org.id);
      
      toast({
        title: 'Success',
        description: 'Organization deleted successfully',
      });
      loadOrganizations();
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete organization',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!session) return;

    try {
      if (editingOrg) {
        // Update existing organization
        await masterDataService.updateOrganization(editingOrg.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description,
          address: formData.address,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
        });
        
        toast({
          title: 'Success',
          description: 'Organization updated successfully',
        });
      } else {
        // Create new organization
        await masterDataService.createOrganization({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          address: formData.address,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
        });
        
        toast({
          title: 'Success',
          description: 'Organization created successfully',
        });
      }

      resetForm();
      setShowForm(false);
      loadOrganizations();
    } catch (error) {
      console.error('Failed to save organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to save organization',
        variant: 'destructive',
      });
    }
  };

  const renderOrganizationCard = (org: Organization) => (
    <Card key={org.id} className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{org.name}</CardTitle>
              <CardDescription className="text-sm">
                Code: {org.code}
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
          {org.description && (
            <p className="text-sm text-gray-600">{org.description}</p>
          )}
          {org.address && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Address:</span> {org.address}
            </p>
          )}
          {org.contactEmail && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Email:</span> {org.contactEmail}
            </p>
          )}
          {org.contactPhone && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Phone:</span> {org.contactPhone}
            </p>
          )}
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(org)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(org)}
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
            {editingOrg ? 'Edit Organization' : 'Create Organization'}
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
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingOrg ? 'Update' : 'Create'}
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
          <h3 className="text-xl font-semibold">Organizations</h3>
          <p className="text-sm text-gray-500">
            Manage organizational hierarchy and company information
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredOrganizations().map(renderOrganizationCard)}
      </div>

      {getFilteredOrganizations().length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No organizations found' : 'No organizations yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first organization'
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          )}
        </div>
      )}

      {renderForm()}
    </div>
  );
};

export default OrganizationList; 