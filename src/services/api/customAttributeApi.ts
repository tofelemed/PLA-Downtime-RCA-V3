import { httpClient } from './httpClient';
import { CustomAttributeDefinition, CustomAttributeValue } from '../../types/CustomAttributes';

export interface CustomAttributeDefinitionDto {
  id: string;
  tenantId?: string | null;
  organizationId?: string | null;
  entityType: string;
  attributeName: string;
  displayName?: string | null;
  description?: string | null;
  dataType?: string | null;
  isRequired: boolean;
  defaultValue?: string | null;
  validationRules?: string | null;
  selectOptions?: string | null;
  displayOrder?: number | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomAttributeValueDto {
  id: string;
  tenantId?: string | null;
  organizationId?: string | null;
  entityId: string;
  entityType: string;
  attributeDefinitionId: string;
  value?: string | null;
  createdAt: string;
  updatedAt: string;
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
    }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON field', value, error);
    return fallback;
  }
};

const toDisplayName = (dto: CustomAttributeDefinitionDto): string =>
  dto.displayName ?? dto.attributeName;

export const mapDefinitionDto = (
  dto: CustomAttributeDefinitionDto,
): CustomAttributeDefinition => ({
  id: dto.id,
  entityType: dto.entityType as CustomAttributeDefinition['entityType'],
  name: dto.attributeName,
  displayName: toDisplayName(dto),
  dataType: (dto.dataType ?? 'string') as CustomAttributeDefinition['dataType'],
  isRequired: Boolean(dto.isRequired),
  defaultValue: dto.defaultValue ?? undefined,
  validationRules: parseJson<Record<string, any> | undefined>(dto.validationRules, undefined),
  selectOptions: parseJson<string[] | undefined>(dto.selectOptions, undefined),
  orderIndex: dto.displayOrder ?? 0,
  isActive: dto.isActive,
  tenantId: dto.tenantId ?? undefined,
  organizationId: dto.organizationId ?? undefined,
  createdBy: dto.createdBy ?? 'system',
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

export const mapValueDto = (dto: CustomAttributeValueDto): CustomAttributeValue => ({
  id: dto.id,
  entityId: dto.entityId,
  entityType: dto.entityType as CustomAttributeValue['entityType'],
  attributeDefinitionId: dto.attributeDefinitionId,
  value: dto.value ?? undefined,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

const sanitize = <T extends Record<string, unknown>>(payload: T): T => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    cleaned[key] = value;
  });
  return cleaned as T;
};

export const buildCreateDefinitionPayload = (
  definition: Omit<CustomAttributeDefinition, 'id' | 'createdAt' | 'updatedAt'>,
) =>
  sanitize({
    tenantId: definition.tenantId ?? null,
    organizationId: definition.organizationId ?? null,
    entityType: definition.entityType,
    attributeName: definition.name,
    displayName: definition.displayName ?? definition.name,
    description: undefined,
    dataType: definition.dataType,
    isRequired: definition.isRequired,
    defaultValue: definition.defaultValue ?? null,
    validationRules: definition.validationRules
      ? JSON.stringify(definition.validationRules)
      : null,
    selectOptions: definition.selectOptions ? JSON.stringify(definition.selectOptions) : null,
    displayOrder: definition.orderIndex ?? 0,
    isActive: definition.isActive,
    createdBy: definition.createdBy ?? null,
  });

export const buildUpdateDefinitionPayload = (
  definition: Partial<CustomAttributeDefinition>,
) =>
  sanitize({
    tenantId: definition.tenantId ?? null,
    organizationId: definition.organizationId ?? null,
    entityType: definition.entityType,
    attributeName: definition.name,
    displayName: definition.displayName,
    dataType: definition.dataType,
    isRequired: definition.isRequired,
    defaultValue: definition.defaultValue ?? null,
    validationRules:
      definition.validationRules !== undefined
        ? definition.validationRules
          ? JSON.stringify(definition.validationRules)
          : null
        : undefined,
    selectOptions:
      definition.selectOptions !== undefined
        ? definition.selectOptions
          ? JSON.stringify(definition.selectOptions)
          : null
        : undefined,
    displayOrder: definition.orderIndex,
    isActive: definition.isActive,
    createdBy: definition.createdBy ?? null,
  });

export const buildCreateValuePayload = (
  value: Omit<CustomAttributeValue, 'id' | 'createdAt' | 'updatedAt'> & {
    tenantId?: string;
    organizationId?: string;
  },
) =>
  sanitize({
    tenantId: value.tenantId ?? null,
    organizationId: value.organizationId ?? null,
    entityId: value.entityId,
    entityType: value.entityType,
    attributeDefinitionId: value.attributeDefinitionId,
    value: value.value ?? null,
  });

export const buildUpdateValuePayload = (
  value: Partial<CustomAttributeValue> & {
    tenantId?: string;
    organizationId?: string;
  },
) =>
  sanitize({
    tenantId: value.tenantId ?? null,
    organizationId: value.organizationId ?? null,
    entityId: value.entityId,
    entityType: value.entityType,
    attributeDefinitionId: value.attributeDefinitionId,
    value: value.value ?? null,
  });

export const customAttributeApi = {
  /* Definitions */
  getDefinitions(params?: { tenantId?: string; organizationId?: string; entityType?: string }) {
    return httpClient.request<CustomAttributeDefinitionDto[]>('custom-attribute-definitions', {
      method: 'GET',
      query: params,
    });
  },

  getDefinition(id: string) {
    return httpClient.request<CustomAttributeDefinitionDto>(`custom-attribute-definitions/${id}`, {
      method: 'GET',
    });
  },

  createDefinition(payload: ReturnType<typeof buildCreateDefinitionPayload>) {
    return httpClient.request<CustomAttributeDefinitionDto>('custom-attribute-definitions', {
      method: 'POST',
      body: payload,
    });
  },

  updateDefinition(id: string, payload: ReturnType<typeof buildUpdateDefinitionPayload>) {
    return httpClient.request<CustomAttributeDefinitionDto>(`custom-attribute-definitions/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteDefinition(id: string) {
    return httpClient.request<void>(`custom-attribute-definitions/${id}`, {
      method: 'DELETE',
    });
  },

  /* Values */
  getValues(params?: {
    tenantId?: string;
    organizationId?: string;
    entityId?: string;
    entityType?: string;
    attributeDefinitionId?: string;
  }) {
    return httpClient.request<CustomAttributeValueDto[]>('custom-attribute-values', {
      method: 'GET',
      query: params,
    });
  },

  createValue(payload: ReturnType<typeof buildCreateValuePayload>) {
    return httpClient.request<CustomAttributeValueDto>('custom-attribute-values', {
      method: 'POST',
      body: payload,
    });
  },

  updateValue(id: string, payload: ReturnType<typeof buildUpdateValuePayload>) {
    return httpClient.request<CustomAttributeValueDto>(`custom-attribute-values/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteValue(id: string) {
    return httpClient.request<void>(`custom-attribute-values/${id}`, {
      method: 'DELETE',
    });
  },
};


