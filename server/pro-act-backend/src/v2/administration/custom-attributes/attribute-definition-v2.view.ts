import { CustomAttributeDefinition } from '../../../custom-attribute-definition/custom-attribute-definition.entity';

export interface AttributeValidationView {
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  pattern: string | null;
}

/** `GET /v2/custom-attribute-definitions` item. */
export interface AttributeDefinitionV2View {
  id: string;
  /** `Organization` | `Tenant` | `Unit` | `Asset` (screens show a label) */
  entityType: string;
  /** internal name (a key, e.g. `location_code`); shown only in the definition form */
  name: string;
  displayName: string;
  description: string | null;
  /** `string` | `number` | `boolean` | `date` | `select` */
  dataType: string;
  isRequired: boolean;
  defaultValue: string | null;
  validationRules: AttributeValidationView;
  selectOptions: string[];
  displayOrder: number;
  isActive: boolean;
  /** where it applies: this plant, the plant's organization, or every plant */
  scope: 'plant' | 'organization' | 'global';
  /** whether the caller may change or delete it here */
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseValidation(
  raw: string | null | undefined,
): AttributeValidationView {
  const parsed = parseJson(raw);
  const rules = isRecord(parsed) ? parsed : {};
  return {
    minLength: numberOrNull(rules.minLength),
    maxLength: numberOrNull(rules.maxLength),
    minValue: numberOrNull(rules.minValue),
    maxValue: numberOrNull(rules.maxValue),
    pattern:
      typeof rules.pattern === 'string' && rules.pattern ? rules.pattern : null,
  };
}

export function parseOptions(raw: string | null | undefined): string[] {
  const parsed = parseJson(raw);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}

export function scopeOf(
  definition: CustomAttributeDefinition,
): AttributeDefinitionV2View['scope'] {
  if (definition.tenantId) return 'plant';
  return definition.organizationId ? 'organization' : 'global';
}

export function toAttributeView(
  definition: CustomAttributeDefinition,
  editable: boolean,
): AttributeDefinitionV2View {
  return {
    id: definition.id,
    entityType: definition.entityType,
    name: definition.attributeName,
    displayName: definition.displayName || definition.attributeName,
    description: definition.description ?? null,
    dataType: definition.dataType ?? 'string',
    isRequired: definition.isRequired,
    defaultValue: definition.defaultValue ?? null,
    validationRules: parseValidation(definition.validationRules),
    selectOptions: parseOptions(definition.selectOptions),
    displayOrder: definition.displayOrder ?? 0,
    isActive: definition.isActive,
    scope: scopeOf(definition),
    editable,
    createdAt: new Date(definition.createdAt).toISOString(),
    updatedAt: new Date(definition.updatedAt).toISOString(),
  };
}
