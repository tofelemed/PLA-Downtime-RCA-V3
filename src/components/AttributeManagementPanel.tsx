import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Settings, 
  Building2, 
  Factory, 
  Wrench, 
  Package,
  ChevronDown,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { customAttributeService } from '@/services/CustomAttributeService';
import { 
  CustomAttributeDefinition, 
  AttributeFormData, 
  EntityType 
} from '@/types/CustomAttributes';

const AttributeManagementPanel: React.FC = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<EntityType>('Organization');
  const [definitions, setDefinitions] = useState<CustomAttributeDefinition[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<CustomAttributeDefinition | null>(null);
  const [expandedDefinitions, setExpandedDefinitions] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<AttributeFormData>({
    name: '',
    displayName: '',
    dataType: 'string',
    isRequired: false,
    defaultValue: '',
    minLength: undefined,
    maxLength: undefined,
    minValue: undefined,
    maxValue: undefined,
    pattern: '',
    selectOptions: [],
    orderIndex: 0,
    isActive: true,
    tenantId: undefined,
    organizationId: undefined,
  });

  const entityTypeIcons = {
    Organization: Building2,
    Tenant: Factory,
    Unit: Wrench,
    Asset: Package,
  };

  const dataTypeOptions = [
    { value: 'string', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Yes/No' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Selection List' },
  ];

  useEffect(() => {
    loadDefinitions();
  }, [activeTab, session]);

  const loadDefinitions = async () => {
    try {
      const tenantId = session?.tenant?.id;
      const organizationId = session?.organization?.id;
      const defs = await customAttributeService.getAttributeDefinitions(activeTab, tenantId, organizationId);
      setDefinitions(defs);
    } catch (error) {
      console.error('Failed to load definitions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attribute definitions',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      dataType: 'string',
      isRequired: false,
      defaultValue: '',
      minLength: undefined,
      maxLength: undefined,
      minValue: undefined,
      maxValue: undefined,
      pattern: '',
      selectOptions: [],
      orderIndex: 0,
      isActive: true,
      tenantId: undefined,
      organizationId: undefined,
    });
    setEditingDefinition(null);
  };

  const openDialog = (definition?: CustomAttributeDefinition) => {
    if (definition) {
      setEditingDefinition(definition);
      setFormData({
        name: definition.name,
        displayName: definition.displayName,
        dataType: definition.dataType,
        isRequired: definition.isRequired,
        defaultValue: definition.defaultValue || '',
        minLength: definition.validationRules?.minLength,
        maxLength: definition.validationRules?.maxLength,
        minValue: definition.validationRules?.minValue,
        maxValue: definition.validationRules?.maxValue,
        pattern: definition.validationRules?.pattern || '',
        selectOptions: definition.selectOptions || [],
        orderIndex: definition.orderIndex,
        isActive: definition.isActive,
        tenantId: definition.tenantId,
        organizationId: definition.organizationId,
      });
    } else {
      resetForm();
      // Set default values for new attribute
      customAttributeService.getNextOrderIndex(activeTab, session?.tenant?.id, session?.organization?.id)
        .then(orderIndex => {
          setFormData(prev => ({ ...prev, orderIndex }));
        });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDefinition) {
        await customAttributeService.updateAttributeDefinition(editingDefinition.id, formData);
        toast({
          title: 'Success',
          description: 'Attribute definition updated successfully',
        });
      } else {
        await customAttributeService.createAttributeDefinition(formData, session?.user?.name || 'Unknown');
        toast({
          title: 'Success',
          description: 'Attribute definition created successfully',
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadDefinitions();
    } catch (error) {
      console.error('Failed to save attribute definition:', error);
      toast({
        title: 'Error',
        description: 'Failed to save attribute definition',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attribute? This will also delete all values for this attribute.')) {
      return;
    }

    try {
      await customAttributeService.deleteAttributeDefinition(id);
      toast({
        title: 'Success',
        description: 'Attribute definition deleted successfully',
      });
      loadDefinitions();
    } catch (error) {
      console.error('Failed to delete attribute definition:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete attribute definition',
        variant: 'destructive',
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDefinitions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const addSelectOption = () => {
    setFormData(prev => ({
      ...prev,
      selectOptions: [...(prev.selectOptions || []), ''],
    }));
  };

  const updateSelectOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      selectOptions: prev.selectOptions?.map((opt, i) => i === index ? value : opt) || [],
    }));
  };

  const removeSelectOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectOptions: prev.selectOptions?.filter((_, i) => i !== index) || [],
    }));
  };

  const getScopeBadge = (definition: CustomAttributeDefinition) => {
    if (definition.tenantId) return <Badge variant="secondary">Tenant-specific</Badge>;
    if (definition.organizationId) return <Badge variant="outline">Organization-specific</Badge>;
    return <Badge variant="default">Global</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Custom Attributes Management</h2>
          <p className="text-muted-foreground">
            Define custom attributes for each level of your plant hierarchy
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Attribute
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EntityType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="Organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="Tenant" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="Unit" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Units
          </TabsTrigger>
          <TabsTrigger value="Asset" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {definitions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Attributes Defined</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Get started by creating custom attributes for {activeTab.toLowerCase()}s
                </p>
                <Button onClick={() => openDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Attribute
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {definitions.map((definition) => (
                <Card key={definition.id} className="border">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <button 
                      onClick={() => toggleExpand(definition.id)} 
                      className="focus:outline-none hover:bg-gray-100 rounded p-1"
                    >
                      {expandedDefinitions.has(definition.id) ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                    <div className={`p-2 rounded-lg bg-blue-100 text-blue-600`}>
                      {React.createElement(entityTypeIcons[definition.entityType], { className: "h-4 w-4" })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{definition.displayName}</span>
                        <Badge variant="outline">{definition.dataType}</Badge>
                        {definition.isRequired && <Badge variant="destructive">Required</Badge>}
                        {getScopeBadge(definition)}
                      </div>
                      <p className="text-sm text-gray-500">{definition.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(definition)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(definition.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  {expandedDefinitions.has(definition.id) && (
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Default Value:</span>
                          <span className="ml-2 text-gray-600">
                            {definition.defaultValue || 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Order:</span>
                          <span className="ml-2 text-gray-600">{definition.orderIndex}</span>
                        </div>
                        {definition.validationRules && (
                          <div className="col-span-2">
                            <span className="font-medium">Validation Rules:</span>
                            <div className="ml-2 mt-1 text-gray-600">
                              {definition.validationRules.minLength && (
                                <div>Min length: {definition.validationRules.minLength}</div>
                              )}
                              {definition.validationRules.maxLength && (
                                <div>Max length: {definition.validationRules.maxLength}</div>
                              )}
                              {definition.validationRules.minValue !== undefined && (
                                <div>Min value: {definition.validationRules.minValue}</div>
                              )}
                              {definition.validationRules.maxValue !== undefined && (
                                <div>Max value: {definition.validationRules.maxValue}</div>
                              )}
                              {definition.validationRules.pattern && (
                                <div>Pattern: {definition.validationRules.pattern}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {definition.selectOptions && definition.selectOptions.length > 0 && (
                          <div className="col-span-2">
                            <span className="font-medium">Options:</span>
                            <div className="ml-2 mt-1">
                              {definition.selectOptions.map((option, index) => (
                                <Badge key={index} variant="secondary" className="mr-1 mb-1">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDefinition ? 'Edit Attribute' : 'Create New Attribute'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Attribute Name (Internal)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., location_code"
                  required
                />
                <p className="text-xs text-gray-500">Internal identifier (no spaces, lowercase)</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g., Location Code"
                  required
                />
                <p className="text-xs text-gray-500">User-friendly name shown in forms</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataType">Data Type</Label>
                <Select 
                  value={formData.dataType} 
                  onValueChange={(value) => setFormData({ ...formData, dataType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orderIndex">Display Order</Label>
                <Input
                  id="orderIndex"
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
              />
              <Label htmlFor="isRequired">Required field</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            {formData.dataType === 'string' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minLength">Minimum Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    value={formData.minLength || ''}
                    onChange={(e) => setFormData({ ...formData, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLength">Maximum Length</Label>
                  <Input
                    id="maxLength"
                    type="number"
                    value={formData.maxLength || ''}
                    onChange={(e) => setFormData({ ...formData, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                    min="1"
                  />
                </div>
              </div>
            )}

            {formData.dataType === 'number' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minValue">Minimum Value</Label>
                  <Input
                    id="minValue"
                    type="number"
                    value={formData.minValue || ''}
                    onChange={(e) => setFormData({ ...formData, minValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxValue">Maximum Value</Label>
                  <Input
                    id="maxValue"
                    type="number"
                    value={formData.maxValue || ''}
                    onChange={(e) => setFormData({ ...formData, maxValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
              </div>
            )}

            {formData.dataType === 'select' && (
              <div className="space-y-2">
                <Label>Select Options</Label>
                <div className="space-y-2">
                  {formData.selectOptions?.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateSelectOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeSelectOption(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSelectOption}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="defaultValue">Default Value</Label>
              <Input
                id="defaultValue"
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                placeholder="Default value for this attribute"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern">Validation Pattern (Regex)</Label>
              <Input
                id="pattern"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                placeholder="e.g., ^[A-Z]{2}\\d{3}$ for AB123 format"
              />
              <p className="text-xs text-gray-500">Optional regex pattern for validation</p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingDefinition ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttributeManagementPanel;
