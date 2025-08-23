import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, Asset, Unit } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { piStore } from '@/services/pi/PIStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from 'lucide-react';

interface AssetFormData {
  name: string;
  code: string;
  description: string;
  unitId: string;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  criticality: string;
  status: string;
  location: string;
}

const AssetList: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [piBindingsByAsset, setPiBindingsByAsset] = useState<Record<string, any[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<AssetFormData>({
    name: '',
    code: '',
    description: '',
    unitId: '',
    assetType: 'Equipment',
    manufacturer: '',
    model: '',
    serialNumber: '',
    criticality: 'Medium',
    status: 'Active',
    location: '',
  });

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    if (!session) return;

    try {
      const [assetsData, unitsData] = await Promise.all([
        masterDataService.getAssets({}),
        masterDataService.getUnits({}),
      ]);
      setAssets(assetsData);
      setUnits(unitsData);
      const tenantId = session?.tenant?.id || 'default-tenant';
      const bindings = await piStore.listBindings(tenantId);
      const map: Record<string, any[]> = {};
      for (const b of bindings) {
        if (b.boundType === 'asset') {
          if (!map[b.localId]) map[b.localId] = [];
          map[b.localId].push(b);
        }
      }
      setPiBindingsByAsset(map);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assets and units',
        variant: 'destructive',
      });
    }
  };

  const getFilteredAssets = () => {
    if (!searchQuery) return assets;
    
    return assets.filter(asset => 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.model?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getUnitName = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    return unit?.name || 'Unknown Unit';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      unitId: '',
      assetType: 'Equipment',
      manufacturer: '',
      model: '',
      serialNumber: '',
      criticality: 'Medium',
      status: 'Active',
      location: '',
    });
    setEditingAsset(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      code: asset.code,
      description: asset.description || '',
      unitId: asset.unitId || '',
      assetType: asset.assetType || 'Equipment',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      criticality: asset.criticality || 'Medium',
      status: asset.status || 'Active',
      location: asset.location || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Are you sure you want to delete "${asset.name}"?`)) return;

    try {
      await masterDataService.deleteAsset(asset.id);
      
      toast({
        title: 'Success',
        description: 'Asset deleted successfully',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete asset',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!session) return;

    try {
      if (editingAsset) {
        // Update existing asset
        await masterDataService.updateAsset(editingAsset.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description,
          unitId: formData.unitId,
          assetType: formData.assetType,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serialNumber: formData.serialNumber,
          criticality: formData.criticality,
          status: formData.status,
          location: formData.location,
        });
        
        toast({
          title: 'Success',
          description: 'Asset updated successfully',
        });
      } else {
        // Create new asset
        await masterDataService.createAsset({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          unitId: formData.unitId,
          assetType: formData.assetType,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serialNumber: formData.serialNumber,
          criticality: formData.criticality,
          status: formData.status,
          location: formData.location,
        });
        
        toast({
          title: 'Success',
          description: 'Asset created successfully',
        });
      }

      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Failed to save asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to save asset',
        variant: 'destructive',
      });
    }
  };

  const renderAssetCard = (asset: Asset) => (
    <Card key={asset.id} className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{asset.name}</CardTitle>
              <CardDescription className="text-sm">
                Code: {asset.code} • {getUnitName(asset.unitId || '')}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <Badge className={getStatusColor(asset.status || 'Active')}>
              {asset.status || 'Active'}
            </Badge>
            <Badge className={getCriticalityColor(asset.criticality || 'Medium')}>
              {asset.criticality || 'Medium'}
            </Badge>
            {piBindingsByAsset[asset.id]?.length ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1">
                      <Database className="w-3 h-3" /> PI Bound
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[420px] break-all">
                    {piBindingsByAsset[asset.id].slice(0,3).map((b) => (
                      <div key={b.id} className="text-xs">{b.webId}</div>
                    ))}
                    {piBindingsByAsset[asset.id].length > 3 && (
                      <div className="text-[11px] text-muted-foreground">+{piBindingsByAsset[asset.id].length - 3} more…</div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {asset.description && (
            <p className="text-sm text-gray-600">{asset.description}</p>
          )}
          {asset.manufacturer && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Manufacturer:</span> {asset.manufacturer}
            </p>
          )}
          {asset.model && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Model:</span> {asset.model}
            </p>
          )}
          {asset.serialNumber && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Serial:</span> {asset.serialNumber}
            </p>
          )}
          {asset.location && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Location:</span> {asset.location}
            </p>
          )}
          <p className="text-xs text-gray-500">
            <span className="font-medium">Type:</span> {asset.assetType || 'Equipment'}
          </p>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(asset)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(asset)}
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
            {editingAsset ? 'Edit Asset' : 'Create Asset'}
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
            <Label htmlFor="unitId">Production Unit</Label>
            <Select
              value={formData.unitId}
              onValueChange={(value) => setFormData({ ...formData, unitId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit (optional)" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
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
            <Label htmlFor="assetType">Asset Type</Label>
            <Select
              value={formData.assetType}
              onValueChange={(value) => setFormData({ ...formData, assetType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Equipment">Equipment</SelectItem>
                <SelectItem value="Instrument">Instrument</SelectItem>
                <SelectItem value="Tool">Tool</SelectItem>
                <SelectItem value="Vehicle">Vehicle</SelectItem>
                <SelectItem value="Building">Building</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="criticality">Criticality</Label>
              <Select
                value={formData.criticality}
                onValueChange={(value) => setFormData({ ...formData, criticality: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Building A, Floor 2, Room 101"
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
              {editingAsset ? 'Update' : 'Create'}
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
          <h3 className="text-xl font-semibold">Assets</h3>
          <p className="text-sm text-gray-500">
            Manage equipment and instruments
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Asset
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredAssets().map(renderAssetCard)}
      </div>

      {getFilteredAssets().length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No assets found' : 'No assets yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first asset'
            }
          </p>
          {!searchQuery && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Asset
            </Button>
          )}
        </div>
      )}

      {renderForm()}
    </div>
  );
};

export default AssetList; 