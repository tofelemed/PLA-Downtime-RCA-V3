import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { 
  CustomAttributeDefinition, 
  CustomAttributeValue, 
  EntityType 
} from '@/types/CustomAttributes';
import { customAttributeService } from '@/services/CustomAttributeService';

interface CustomAttributeFormProps {
  entityId: string;
  entityType: EntityType;
  tenantId?: string;
  organizationId?: string;
  onValuesChange?: (values: { attributeDefinitionId: string; value?: string }[]) => void;
  showValidationErrors?: boolean;
}

const CustomAttributeForm: React.FC<CustomAttributeFormProps> = ({
  entityId,
  entityType,
  tenantId,
  organizationId,
  onValuesChange,
  showValidationErrors = true,
}) => {
  const [definitions, setDefinitions] = useState<CustomAttributeDefinition[]>([]);
  const [values, setValues] = useState<{ attributeDefinitionId: string; value?: string }[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDefinitions();
  }, [entityType, tenantId, organizationId]);

  useEffect(() => {
    if (entityId && definitions.length > 0) {
      loadValues();
    }
  }, [entityId, definitions]);

  const loadDefinitions = async () => {
    try {
      setLoading(true);
      const defs = await customAttributeService.getAttributeDefinitions(entityType, tenantId, organizationId);
      setDefinitions(defs.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (error) {
      console.error('Failed to load attribute definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadValues = async () => {
    try {
      const existingValues = await customAttributeService.getAttributeValues(entityId, entityType);
      const valueMap = existingValues.map(v => ({
        attributeDefinitionId: v.attributeDefinitionId,
        value: v.value,
      }));
      setValues(valueMap);
      
      // Initialize missing values with defaults
      const allValues = definitions.map(def => {
        const existing = valueMap.find(v => v.attributeDefinitionId === def.id);
        return existing || {
          attributeDefinitionId: def.id,
          value: def.defaultValue || '',
        };
      });
      setValues(allValues);
      
      if (onValuesChange) {
        onValuesChange(allValues);
      }
    } catch (error) {
      console.error('Failed to load attribute values:', error);
    }
  };

  const handleValueChange = async (attributeDefinitionId: string, value: string) => {
    const newValues = values.map(v => 
      v.attributeDefinitionId === attributeDefinitionId ? { ...v, value } : v
    );
    setValues(newValues);

    // Validate the new value
    const definition = definitions.find(d => d.id === attributeDefinitionId);
    if (definition && showValidationErrors) {
      const validation = await customAttributeService.validateAttributeValue(definition, value);
      setValidationErrors(prev => ({
        ...prev,
        [attributeDefinitionId]: validation.errors,
      }));
    }

    if (onValuesChange) {
      onValuesChange(newValues);
    }
  };

  const renderField = (definition: CustomAttributeDefinition) => {
    const value = values.find(v => v.attributeDefinitionId === definition.id)?.value || '';
    const errors = validationErrors[definition.id] || [];
    const hasError = errors.length > 0;

    const commonProps = {
      id: `attr_${definition.id}`,
      value: value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleValueChange(definition.id, e.target.value),
      className: hasError ? 'border-red-500' : '',
    };

    switch (definition.dataType) {
      case 'string':
        if (definition.validationRules?.maxLength && definition.validationRules.maxLength > 100) {
          return (
            <div className="space-y-2">
              <Label htmlFor={commonProps.id}>
                {definition.displayName}
                {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                {...commonProps}
                placeholder={`Enter ${definition.displayName.toLowerCase()}`}
                rows={3}
              />
              {hasError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors[0]}
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <Label htmlFor={commonProps.id}>
              {definition.displayName}
              {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              placeholder={`Enter ${definition.displayName.toLowerCase()}`}
            />
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors[0]}
              </div>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={commonProps.id}>
              {definition.displayName}
              {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="number"
              placeholder={`Enter ${definition.displayName.toLowerCase()}`}
            />
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors[0]}
              </div>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-2">
            <Label htmlFor={commonProps.id} className="flex items-center gap-2">
              <Switch
                id={commonProps.id}
                checked={value === 'true'}
                onCheckedChange={(checked) => handleValueChange(definition.id, checked ? 'true' : 'false')}
              />
              {definition.displayName}
              {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors[0]}
              </div>
            )}
          </div>
        );

      case 'date':
        return (
          <div className="space-y-2">
            <Label htmlFor={commonProps.id}>
              {definition.displayName}
              {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="date"
            />
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors[0]}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={commonProps.id}>
              {definition.displayName}
              {definition.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleValueChange(definition.id, val)}>
              <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                <SelectValue placeholder={`Select ${definition.displayName.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {definition.selectOptions?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors[0]}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Custom Attributes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {definitions.map((definition) => (
            <div key={definition.id} className="space-y-2">
              {renderField(definition)}
              {definition.description && (
                <p className="text-xs text-gray-500">{definition.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomAttributeForm;
