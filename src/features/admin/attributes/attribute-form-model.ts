import type { AttributeDataType, AttributeDefinitionInput, AttributeDefinitionView, AttributeEntityType } from '@/api/v2/types/administration';

/** The attribute form as typed (numbers as text so a field can be left empty). */
export interface AttributeFormValues {
  entityType: AttributeEntityType;
  name: string;
  displayName: string;
  description: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  isActive: boolean;
  defaultValue: string;
  minLength: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  pattern: string;
  /** one choice per line */
  options: string;
  displayOrder: string;
}

export type AttributeFormErrors = Partial<Record<keyof AttributeFormValues, string>>;

const NAME = /^[a-z][a-z0-9_]*$/;
const text = (value: number | null) => (value === null ? '' : String(value));
const number = (value: string) => (value.trim() === '' ? undefined : Number(value));

export function emptyAttributeForm(entityType: AttributeEntityType): AttributeFormValues {
  return {
    entityType, name: '', displayName: '', description: '', dataType: 'string', isRequired: false, isActive: true,
    defaultValue: '', minLength: '', maxLength: '', minValue: '', maxValue: '', pattern: '', options: '', displayOrder: '',
  };
}

export function attributeFormOf(view: AttributeDefinitionView): AttributeFormValues {
  const rules = view.validationRules;
  return {
    entityType: view.entityType as AttributeEntityType,
    name: view.name,
    displayName: view.displayName,
    description: view.description ?? '',
    dataType: view.dataType as AttributeDataType,
    isRequired: view.isRequired,
    isActive: view.isActive,
    defaultValue: view.defaultValue ?? '',
    minLength: text(rules.minLength),
    maxLength: text(rules.maxLength),
    minValue: text(rules.minValue),
    maxValue: text(rules.maxValue),
    pattern: rules.pattern ?? '',
    options: view.selectOptions.join('\n'),
    displayOrder: String(view.displayOrder),
  };
}

const optionsOf = (raw: string) => raw.split('\n').map((line) => line.trim()).filter(Boolean);
const notNumber = (value: string) => value.trim() !== '' && !Number.isFinite(Number(value));

export function validateAttributeForm(values: AttributeFormValues, mode: 'create' | 'edit'): AttributeFormErrors {
  const errors: AttributeFormErrors = {};
  if (mode === 'create' && !NAME.test(values.name)) errors.name = 'Lowercase letters, digits and “_”, starting with a letter.';
  if (!values.displayName.trim()) errors.displayName = 'Enter the name people see.';
  for (const key of ['minLength', 'maxLength', 'minValue', 'maxValue', 'displayOrder'] as const) {
    if (notNumber(values[key])) errors[key] = 'Enter a number.';
  }
  if (values.dataType === 'select' && optionsOf(values.options).length === 0) errors.options = 'Enter at least one choice.';
  return errors;
}

/** The request body; validation rules only for the data types they apply to. */
export function toAttributeInput(values: AttributeFormValues, mode: 'create' | 'edit'): AttributeDefinitionInput {
  const isText = values.dataType === 'string';
  const isNumber = values.dataType === 'number';
  const rules = {
    ...(isText ? { minLength: number(values.minLength), maxLength: number(values.maxLength), pattern: values.pattern.trim() || undefined } : {}),
    ...(isNumber ? { minValue: number(values.minValue), maxValue: number(values.maxValue) } : {}),
  };
  const definedRules = Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== undefined));
  return {
    ...(mode === 'create' ? { entityType: values.entityType, name: values.name } : {}),
    displayName: values.displayName.trim(),
    description: values.description.trim(),
    dataType: values.dataType,
    isRequired: values.isRequired,
    isActive: values.isActive,
    defaultValue: values.defaultValue,
    validationRules: definedRules,
    selectOptions: values.dataType === 'select' ? optionsOf(values.options) : [],
    ...(values.displayOrder.trim() ? { displayOrder: Number(values.displayOrder) } : {}),
  };
}
