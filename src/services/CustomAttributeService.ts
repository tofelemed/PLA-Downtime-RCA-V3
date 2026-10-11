import {
  CustomAttributeDefinition,
  CustomAttributeValue,
  AttributeFormData,
  EntityType,
  ValidationRules,
} from '../types/CustomAttributes';
import {
  customAttributeApi,
  mapDefinitionDto,
  mapValueDto,
  buildCreateDefinitionPayload,
  buildUpdateDefinitionPayload,
  buildCreateValuePayload,
  buildUpdateValuePayload,
} from './api/customAttributeApi';

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
    const response = await customAttributeApi.getDefinitions({ entityType, tenantId, organizationId });
    const mapped = response.map(mapDefinitionDto);
    return mapped.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  async createAttributeDefinition(data: AttributeFormData, createdBy: string): Promise<CustomAttributeDefinition> {
    const validationRules: ValidationRules = {};
    if (data.minLength !== undefined) validationRules.minLength = data.minLength;
    if (data.maxLength !== undefined) validationRules.maxLength = data.maxLength;
    if (data.minValue !== undefined) validationRules.minValue = data.minValue;
    if (data.maxValue !== undefined) validationRules.maxValue = data.maxValue;
    if (data.pattern) validationRules.pattern = data.pattern;
    if (data.customValidation) validationRules.customValidation = data.customValidation;

    const baseDefinition: Omit<CustomAttributeDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
      entityType: data.entityType,
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
    };

    const payload = buildCreateDefinitionPayload(baseDefinition);
    const dto = await customAttributeApi.createDefinition(payload);
    return mapDefinitionDto(dto);
  }

  async updateAttributeDefinition(id: string, data: Partial<AttributeFormData>): Promise<CustomAttributeDefinition | null> {
    const validationRules: ValidationRules = {};
    if (data.minLength !== undefined) validationRules.minLength = data.minLength;
    if (data.maxLength !== undefined) validationRules.maxLength = data.maxLength;
    if (data.minValue !== undefined) validationRules.minValue = data.minValue;
    if (data.maxValue !== undefined) validationRules.maxValue = data.maxValue;
    if (data.pattern) validationRules.pattern = data.pattern;
    if (data.customValidation) validationRules.customValidation = data.customValidation;

    const payload = buildUpdateDefinitionPayload({
      entityType: data.entityType,
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
    });

    const dto = await customAttributeApi.updateDefinition(id, payload);
    return mapDefinitionDto(dto);
  }

  async deleteAttributeDefinition(id: string): Promise<void> {
    // Delete all values for this attribute first
    const values = await this.getAttributeValuesByDefinition(id);
    for (const value of values) {
      await customAttributeApi.deleteValue(value.id);
    }
    
    // Delete the definition
    await customAttributeApi.deleteDefinition(id);
  }

  // Attribute Values
  async getAttributeValues(entityId: string, entityType: EntityType): Promise<CustomAttributeValue[]> {
    const response = await customAttributeApi.getValues({ entityId, entityType });
    return response.map(mapValueDto);
  }

  async getAttributeValuesByDefinition(attributeDefinitionId: string): Promise<CustomAttributeValue[]> {
    const response = await customAttributeApi.getValues({ attributeDefinitionId });
    return response.map(mapValueDto);
  }

  async setAttributeValue(
    entityId: string, 
    entityType: EntityType, 
    attributeDefinitionId: string, 
    value?: string
  ): Promise<CustomAttributeValue> {
    // Check if value already exists
    const existingValues = await this.getAttributeValues(entityId, entityType);
    const existing = existingValues.find(v => v.attributeDefinitionId === attributeDefinitionId);
    
    if (existing) {
      // Update existing value
      const payload = buildUpdateValuePayload({
        id: existing.id,
        entityId,
        entityType,
        attributeDefinitionId,
        value,
      });
      const dto = await customAttributeApi.updateValue(existing.id, payload);
      return mapValueDto(dto);
    } else {
      // Create new value
      const payload = buildCreateValuePayload({
        entityId,
        entityType,
        attributeDefinitionId,
        value,
      });
      const dto = await customAttributeApi.createValue(payload);
      return mapValueDto(dto);
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
    await customAttributeApi.deleteValue(id);
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
