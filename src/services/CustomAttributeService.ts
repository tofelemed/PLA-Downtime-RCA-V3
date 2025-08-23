import { storageService } from './StorageService';
import { 
  CustomAttributeDefinition, 
  CustomAttributeValue, 
  AttributeFormData, 
  EntityType,
  ValidationRules 
} from '../types/CustomAttributes';

export class CustomAttributeService {
  private static instance: CustomAttributeService;
  
  public static getInstance(): CustomAttributeService {
    if (!CustomAttributeService.instance) {
      CustomAttributeService.instance = new CustomAttributeService();
    }
    return CustomAttributeService.instance;
  }

  // Attribute Definitions
  async getAttributeDefinitions(
    entityType?: EntityType, 
    tenantId?: string, 
    organizationId?: string
  ): Promise<CustomAttributeDefinition[]> {
    try {
      // Check if storage service is available and initialized
      if (!storageService || !(storageService as any).db) {
        console.warn('Storage service not ready, returning empty attribute definitions');
        return [];
      }

      let definitions = await storageService.query<CustomAttributeDefinition>('customAttributeDefinitions');
      
      // Filter by entity type if specified
      if (entityType) {
        definitions = definitions.filter(d => d.entityType === entityType);
      }
      
      // Filter by tenant/organization scope
      if (tenantId || organizationId) {
        definitions = definitions.filter(d => {
          // Global attributes (no tenant/organization restriction)
          if (!d.tenantId && !d.organizationId) return true;
          
          // Tenant-specific attributes
          if (tenantId && d.tenantId === tenantId) return true;
          
          // Organization-specific attributes
          if (organizationId && d.organizationId === organizationId) return true;
          
          return false;
        });
      }
      
      // Sort by order index
      return definitions.sort((a, b) => a.orderIndex - b.orderIndex);
    } catch (error) {
      console.error('Failed to get attribute definitions:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  async createAttributeDefinition(data: AttributeFormData, createdBy: string): Promise<CustomAttributeDefinition> {
    try {
      const now = new Date().toISOString();
      
      // Build validation rules
      const validationRules: ValidationRules = {};
      if (data.minLength !== undefined) validationRules.minLength = data.minLength;
      if (data.maxLength !== undefined) validationRules.maxLength = data.maxLength;
      if (data.minValue !== undefined) validationRules.minValue = data.minValue;
      if (data.maxValue !== undefined) validationRules.maxValue = data.maxValue;
      if (data.pattern) validationRules.pattern = data.pattern;
      if (data.customValidation) validationRules.customValidation = data.customValidation;

      const definition: CustomAttributeDefinition = {
        id: crypto.randomUUID(),
        entityType: data.entityType as EntityType,
        name: data.name,
        displayName: data.displayName,
        dataType: data.dataType,
        isRequired: data.isRequired,
        defaultValue: data.defaultValue,
        validationRules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
        selectOptions: data.selectOptions,
        orderIndex: data.orderIndex,
        isActive: data.isActive,
        tenantId: data.tenantId,
        organizationId: data.organizationId,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await storageService.create('customAttributeDefinitions', definition);
      return definition;
    } catch (error) {
      console.error('Failed to create attribute definition:', error);
      throw error;
    }
  }

  async updateAttributeDefinition(id: string, data: Partial<AttributeFormData>): Promise<CustomAttributeDefinition | null> {
    try {
      const existing = await storageService.get<CustomAttributeDefinition>('customAttributeDefinitions', id);
      if (!existing) return null;

      const now = new Date().toISOString();
      
      // Build validation rules
      const validationRules: ValidationRules = {};
      if (data.minLength !== undefined) validationRules.minLength = data.minLength;
      if (data.maxLength !== undefined) validationRules.maxLength = data.maxLength;
      if (data.minValue !== undefined) validationRules.minValue = data.minValue;
      if (data.maxValue !== undefined) validationRules.maxValue = data.maxValue;
      if (data.pattern) validationRules.pattern = data.pattern;
      if (data.customValidation) validationRules.customValidation = data.customValidation;

      const updated: CustomAttributeDefinition = {
        ...existing,
        ...data,
        validationRules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
        updatedAt: now,
      };

      await storageService.update('customAttributeDefinitions', id, updated);
      return updated;
    } catch (error) {
      console.error('Failed to update attribute definition:', error);
      throw error;
    }
  }

  async deleteAttributeDefinition(id: string): Promise<void> {
    try {
      // Delete all values for this attribute first
      const values = await this.getAttributeValuesByDefinition(id);
      for (const value of values) {
        await storageService.delete('customAttributeValues', value.id);
      }
      
      // Delete the definition
      await storageService.delete('customAttributeDefinitions', id);
    } catch (error) {
      console.error('Failed to delete attribute definition:', error);
      throw error;
    }
  }

  // Attribute Values
  async getAttributeValues(entityId: string, entityType: EntityType): Promise<CustomAttributeValue[]> {
    try {
      // Check if storage service is available and initialized
      if (!storageService || !(storageService as any).db) {
        console.warn('Storage service not ready, returning empty attribute values');
        return [];
      }

      const values = await storageService.query<CustomAttributeValue>('customAttributeValues');
      return values.filter(v => v.entityId === entityId && v.entityType === entityType);
    } catch (error) {
      console.error('Failed to get attribute values:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  async getAttributeValuesByDefinition(attributeDefinitionId: string): Promise<CustomAttributeValue[]> {
    try {
      const values = await storageService.query<CustomAttributeValue>('customAttributeValues');
      return values.filter(v => v.attributeDefinitionId === attributeDefinitionId);
    } catch (error) {
      console.error('Failed to get attribute values by definition:', error);
      return [];
    }
  }

  async setAttributeValue(
    entityId: string, 
    entityType: EntityType, 
    attributeDefinitionId: string, 
    value?: string
  ): Promise<CustomAttributeValue> {
    try {
      const now = new Date().toISOString();
      
      // Check if value already exists
      const existingValues = await this.getAttributeValues(entityId, entityType);
      const existing = existingValues.find(v => v.attributeDefinitionId === attributeDefinitionId);
      
      if (existing) {
        // Update existing value
        const updated: CustomAttributeValue = {
          ...existing,
          value,
          updatedAt: now,
        };
        await storageService.update('customAttributeValues', existing.id, updated);
        return updated;
      } else {
        // Create new value
        const newValue: CustomAttributeValue = {
          id: crypto.randomUUID(),
          entityId,
          entityType,
          attributeDefinitionId,
          value,
          createdAt: now,
          updatedAt: now,
        };
        await storageService.create('customAttributeValues', newValue);
        return newValue;
      }
    } catch (error) {
      console.error('Failed to set attribute value:', error);
      throw error;
    }
  }

  async bulkSetAttributeValues(
    entityId: string, 
    entityType: EntityType, 
    values: { attributeDefinitionId: string; value?: string }[]
  ): Promise<CustomAttributeValue[]> {
    try {
      const results: CustomAttributeValue[] = [];
      for (const { attributeDefinitionId, value } of values) {
        const result = await this.setAttributeValue(entityId, entityType, attributeDefinitionId, value);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Failed to bulk set attribute values:', error);
      throw error;
    }
  }

  async deleteAttributeValue(id: string): Promise<void> {
    try {
      await storageService.delete('customAttributeValues', id);
    } catch (error) {
      console.error('Failed to delete attribute value:', error);
      throw error;
    }
  }

  // Utility methods
  async getNextOrderIndex(entityType: EntityType, tenantId?: string, organizationId?: string): Promise<number> {
    const definitions = await this.getAttributeDefinitions(entityType, tenantId, organizationId);
    if (definitions.length === 0) return 0;
    return Math.max(...definitions.map(d => d.orderIndex)) + 1;
  }

  async validateAttributeValue(
    definition: CustomAttributeDefinition, 
    value: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (definition.isRequired && (!value || value.trim() === '')) {
      errors.push(`${definition.displayName} is required`);
      return { isValid: false, errors };
    }
    
    if (!value || value.trim() === '') {
      return { isValid: true, errors: [] }; // Empty value is OK for non-required fields
    }

    const { validationRules } = definition;
    if (!validationRules) return { isValid: true, errors: [] };

    // String validation
    if (definition.dataType === 'string') {
      if (validationRules.minLength && value.length < validationRules.minLength) {
        errors.push(`${definition.displayName} must be at least ${validationRules.minLength} characters`);
      }
      if (validationRules.maxLength && value.length > validationRules.maxLength) {
        errors.push(`${definition.displayName} must be no more than ${validationRules.maxLength} characters`);
      }
      if (validationRules.pattern) {
        const regex = new RegExp(validationRules.pattern);
        if (!regex.test(value)) {
          errors.push(`${definition.displayName} format is invalid`);
        }
      }
    }

    // Number validation
    if (definition.dataType === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push(`${definition.displayName} must be a valid number`);
      } else {
        if (validationRules.minValue !== undefined && numValue < validationRules.minValue) {
          errors.push(`${definition.displayName} must be at least ${validationRules.minValue}`);
        }
        if (validationRules.maxValue !== undefined && numValue > validationRules.maxValue) {
          errors.push(`${definition.displayName} must be no more than ${validationRules.maxValue}`);
        }
      }
    }

    // Date validation
    if (definition.dataType === 'date') {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        errors.push(`${definition.displayName} must be a valid date`);
      }
    }

    // Select validation
    if (definition.dataType === 'select' && definition.selectOptions) {
      if (!definition.selectOptions.includes(value)) {
        errors.push(`${definition.displayName} must be one of: ${definition.selectOptions.join(', ')}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

export const customAttributeService = CustomAttributeService.getInstance();
