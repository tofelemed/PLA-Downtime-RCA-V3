import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Settings, Edit, Trash2 } from 'lucide-react';
import { 
  CustomAttributeDefinition, 
  CustomAttributeValue, 
  EntityType 
} from '@/types/CustomAttributes';
import { customAttributeService } from '@/services/CustomAttributeService';

interface CustomAttributeDisplayProps {
  entityId: string;
  entityType: EntityType;
  tenantId?: string;
  organizationId?: string;
  showHeader?: boolean;
  maxDisplay?: number;
  collapsible?: boolean;
}

const CustomAttributeDisplay: React.FC<CustomAttributeDisplayProps> = ({
  entityId,
  entityType,
  tenantId,
  organizationId,
  showHeader = true,
  maxDisplay = 3,
  collapsible = true,
}) => {
  const [definitions, setDefinitions] = useState<CustomAttributeDefinition[]>([]);
  const [values, setValues] = useState<CustomAttributeValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<CustomAttributeDefinition | null>(null);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    displayName: '',
    dataType: 'string' as 'string' | 'number' | 'boolean' | 'date' | 'select',
    isRequired: false,
    defaultValue: '',
    minLength: undefined as number | undefined,
    maxLength: undefined as number | undefined,
    minValue: undefined as number | undefined,
    maxValue: undefined as number | undefined,
    pattern: '',
    selectOptions: [] as string[],
    orderIndex: 0,
    isActive: true,
  });
  const [newSelectOption, setNewSelectOption] = useState('');

  useEffect(() => {
    console.log('CustomAttributeDisplay useEffect triggered:', { entityId, entityType, tenantId, organizationId });
    loadData();
  }, [entityId, entityType, tenantId, organizationId]);

  // Debug effect for showCreateForm changes
  useEffect(() => {
    console.log('showCreateForm changed to:', showCreateForm);
  }, [showCreateForm]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading custom attributes for:', { entityId, entityType, tenantId, organizationId });
      
      // Check if service is available
      if (!customAttributeService) {
        console.error('CustomAttributeService is not available');
        setLoading(false);
        return;
      }
      
      const [defs, vals] = await Promise.all([
        customAttributeService.getAttributeDefinitions(entityType, tenantId, organizationId),
        customAttributeService.getAttributeValues(entityId, entityType),
      ]);
      
      console.log('Loaded definitions:', defs);
      console.log('Loaded values:', vals);
      
      setDefinitions(defs.sort((a, b) => a.orderIndex - b.orderIndex));
      setValues(vals);
    } catch (error) {
      console.error('Failed to load custom attributes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValueForDefinition = (definitionId: string) => {
    const value = values.find(v => v.attributeDefinitionId === definitionId);
    return value?.value || '';
  };

  const formatValue = (definition: CustomAttributeDefinition, value: string) => {
    if (!value) return '—';
    
    switch (definition.dataType) {
      case 'boolean':
        return value === 'true' ? 'Yes' : 'No';
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return value;
      case 'select':
        return value;
      default:
        return value;
    }
  };

  const getValueColor = (definition: CustomAttributeDefinition, value: string) => {
    if (!value) return 'bg-gray-100 text-gray-600';
    
    switch (definition.dataType) {
      case 'boolean':
        return value === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
      case 'select':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleCreateAttribute = async () => {
    try {
      console.log('handleCreateAttribute called with:', createFormData);
      console.log('CustomAttributeService available:', !!customAttributeService);
      
      // Validate required fields
      if (!createFormData.name || !createFormData.displayName) {
        alert('Name and Display Name are required');
        return;
      }

      // Get next order index
      const nextOrderIndex = await customAttributeService.getNextOrderIndex(entityType, tenantId, organizationId);
      console.log('Next order index:', nextOrderIndex);
      
      const attributeData = {
        ...createFormData,
        entityType: entityType,
        orderIndex: nextOrderIndex,
        tenantId: tenantId,
        organizationId: organizationId,
      };

      console.log('Creating attribute with data:', attributeData);
      
      const newAttribute = await customAttributeService.createAttributeDefinition(
        attributeData, 
        'system' // TODO: Replace with actual user ID
      );
      
      console.log('Created attribute:', newAttribute);
      
      // Reset form and reload data
      setCreateFormData({
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
      });
      setShowCreateForm(false);
      loadData();
    } catch (error) {
      console.error('Failed to create attribute:', error);
      alert('Failed to create attribute: ' + error);
    }
  };

  const handleEditAttribute = async () => {
    if (!editingDefinition) return;
    
    try {
      console.log('Updating attribute:', editingDefinition.id, createFormData);
      
      const updatedAttribute = await customAttributeService.updateAttributeDefinition(
        editingDefinition.id,
        createFormData
      );
      
      if (updatedAttribute) {
        console.log('Attribute updated successfully:', updatedAttribute);
        setEditingDefinition(null);
        setCreateFormData({
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
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to update attribute:', error);
      alert('Failed to update attribute: ' + error);
    }
  };

  const handleDeleteAttribute = async (definitionId: string) => {
    if (!confirm('Are you sure you want to delete this attribute? This action cannot be undone.')) {
      return;
    }
    
    try {
      console.log('Deleting attribute:', definitionId);
      await customAttributeService.deleteAttributeDefinition(definitionId);
      console.log('Attribute deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete attribute:', error);
      alert('Failed to delete attribute: ' + error);
    }
  };

  const startEditing = (definition: CustomAttributeDefinition) => {
    setEditingDefinition(definition);
    setCreateFormData({
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
    });
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setEditingDefinition(null);
    setShowCreateForm(false);
    setCreateFormData({
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
    });
  };

  const addSelectOption = () => {
    if (newSelectOption.trim() && !createFormData.selectOptions.includes(newSelectOption.trim())) {
      setCreateFormData(prev => ({
        ...prev,
        selectOptions: [...prev.selectOptions, newSelectOption.trim()]
      }));
      setNewSelectOption('');
    }
  };

  const removeSelectOption = (option: string) => {
    setCreateFormData(prev => ({
      ...prev,
      selectOptions: prev.selectOptions.filter(o => o !== option)
    }));
  };

  const handleSetValue = async (attributeDefinitionId: string, value: string) => {
    try {
      console.log('Setting value for attribute:', attributeDefinitionId, 'value:', value);
      await customAttributeService.setAttributeValue(entityId, entityType, attributeDefinitionId, value);
      // Reload values to show the updated value
      const updatedValues = await customAttributeService.getAttributeValues(entityId, entityType);
      setValues(updatedValues);
    } catch (error) {
      console.error('Failed to set attribute value:', error);
      alert('Failed to set value: ' + error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }


  // Show create/edit form if it's open, regardless of whether there are existing definitions
  if (showCreateForm) {
    return (
      <div className="space-y-4">
        <div className="border rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-lg font-bold text-gray-900">
              {editingDefinition ? 'Edit Attribute' : 'Create New Attribute'}
            </h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name (Internal)</label>
              <input
                type="text"
                value={createFormData.name}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., location_code"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={createFormData.displayName}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Location Code"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Type</label>
              <select
                value={createFormData.dataType}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, dataType: e.target.value as any }))}
                className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                disabled={editingDefinition !== null} // Disable changing data type when editing
              >
                <option value="string">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Yes/No</option>
                <option value="date">Date</option>
                <option value="select">Selection</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Required</label>
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  checked={createFormData.isRequired}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, isRequired: e.target.checked }))}
                  className="h-3 w-3 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-600">Required field</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default Value</label>
              <input
                type="text"
                value={createFormData.defaultValue}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
                className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          
          {/* Validation Rules */}
          {(createFormData.dataType === 'string' || createFormData.dataType === 'number') && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {createFormData.dataType === 'string' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Min Length</label>
                    <input
                      type="number"
                      value={createFormData.minLength || ''}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, minLength: e.target.value ? parseInt(e.target.value) : undefined }))}
                      className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Length</label>
                    <input
                      type="number"
                      value={createFormData.maxLength || ''}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, maxLength: e.target.value ? parseInt(e.target.value) : undefined }))}
                      className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}
              {createFormData.dataType === 'number' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Min Value</label>
                    <input
                      type="number"
                      value={createFormData.minValue || ''}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, minValue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Value</label>
                    <input
                      type="number"
                      value={createFormData.maxValue || ''}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, maxValue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Select Options */}
          {createFormData.dataType === 'select' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Selection Options</label>
              <div className="space-y-2">
                {createFormData.selectOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{option}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelectOption(option)}
                      className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSelectOption}
                    onChange={(e) => setNewSelectOption(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="Add option..."
                    onKeyPress={(e) => e.key === 'Enter' && addSelectOption()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSelectOption}
                    className="px-2 py-1 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={editingDefinition ? handleEditAttribute : handleCreateAttribute}
              disabled={!createFormData.name || !createFormData.displayName}
            >
              {editingDefinition ? 'Update Attribute' : 'Create Attribute'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show "no attributes" message only when not creating and no definitions exist
  if (definitions.length === 0) {
    return (
      <div className="text-center py-6">
        <Settings className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <h4 className="text-sm font-medium text-gray-900 mb-2">No Custom Attributes Defined</h4>
        <p className="text-sm text-gray-500 mb-4">
          This {entityType.toLowerCase()} doesn't have any custom attributes yet.
        </p>
        <div className="space-y-2">
          <Button 
            size="sm" 
            onClick={() => {
              console.log('Create Custom Attribute button clicked');
              console.log('Current state:', { showCreateForm, entityId, entityType, tenantId, organizationId });
              setShowCreateForm(true);
            }}
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Create Custom Attribute
          </Button>
          <p className="text-xs text-gray-400">
            Entity ID: {entityId} | Type: {entityType}
          </p>
        </div>
      </div>
    );
  }

  const visibleDefinitions = showAll ? definitions : definitions.slice(0, maxDisplay);
  const hasMore = definitions.length > maxDisplay;

  return (
    <div className="space-y-4" style={{position: 'relative'}}>
      {/* Header with Create Button */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Custom Attributes
            <Badge variant="outline" className="text-xs">
              {definitions.length}
            </Badge>
          </h4>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="h-7 px-2 text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Add Attribute
            </Button>
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-6 w-6 p-0"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>
      )}
      

      {/* Existing Attributes */}
      {(!collapsible || expanded) && (
        <div className="space-y-2">
          {visibleDefinitions.map((definition) => {
            const value = getValueForDefinition(definition.id);
            const formattedValue = formatValue(definition, value);
            
            return (
              <div key={definition.id} className="flex items-center justify-between text-sm p-2 border rounded hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-600 font-medium">
                      {definition.displayName}:
                    </span>
                    {definition.isRequired && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Type: {definition.dataType} | Internal: {definition.name}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Value Display/Edit */}
                  <div className="flex items-center gap-2">
                    {definition.dataType === 'boolean' ? (
                      <select
                        value={value || ''}
                        onChange={(e) => handleSetValue(definition.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="">Not Set</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : definition.dataType === 'select' && definition.selectOptions ? (
                      <select
                        value={value || ''}
                        onChange={(e) => handleSetValue(definition.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="">Not Set</option>
                        {definition.selectOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : definition.dataType === 'date' ? (
                      <input
                        type="date"
                        value={value || ''}
                        onChange={(e) => handleSetValue(definition.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      />
                    ) : (
                      <input
                        type={definition.dataType === 'number' ? 'number' : 'text'}
                        value={value || ''}
                        onChange={(e) => handleSetValue(definition.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1 w-24"
                        placeholder="Set value..."
                      />
                    )}
                  </div>
                  
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getValueColor(definition, value)}`}
                  >
                    {formattedValue}
                  </Badge>

                  {/* Edit and Delete Buttons */}
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(definition)}
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Edit Attribute"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttribute(definition.id)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete Attribute"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {hasMore && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-xs"
              >
                {showAll ? 'Show Less' : `Show ${definitions.length - maxDisplay} More`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomAttributeDisplay;
