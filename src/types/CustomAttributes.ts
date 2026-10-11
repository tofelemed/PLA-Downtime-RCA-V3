export interface CustomAttributeDefinition {
  id: string;
  entityType: 'Organization' | 'Tenant' | 'Unit' | 'Asset';
  name: string;
  displayName: string;
  /** Help text under the field; the backend has it, `mapDefinitionDto` does not fill it yet. */
  description?: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'select';
  isRequired: boolean;
  defaultValue?: string;
  validationRules?: ValidationRules;
  selectOptions?: string[];
  orderIndex: number;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomAttributeValue {
  id: string;
  entityId: string;
  entityType: 'Organization' | 'Tenant' | 'Unit' | 'Asset';
  attributeDefinitionId: string;
  value?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  customValidation?: string;
}

export interface AttributeFormData {
  entityType?: EntityType;
  name: string;
  displayName: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'select';
  isRequired: boolean;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  customValidation?: string;
  selectOptions?: string[];
  orderIndex: number;
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
}

export interface AttributeValueFormData {
  attributeDefinitionId: string;
  value?: string;
}

export type EntityType = 'Organization' | 'Tenant' | 'Unit' | 'Asset';
