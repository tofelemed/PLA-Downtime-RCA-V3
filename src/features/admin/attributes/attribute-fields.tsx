import { useId } from 'react';
import { ATTRIBUTE_DATA_TYPES, ATTRIBUTE_ENTITY_TYPES, type AttributeDataType, type AttributeEntityType } from '@/api/v2/types/administration';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ATTRIBUTE_DATA_TYPE_LABELS, ATTRIBUTE_ENTITY_LABELS } from '@/features/ux-kit/labels';
import { FormField } from '../shared/form-field';
import type { AttributeFormErrors, AttributeFormValues } from './attribute-form-model';

export interface AttributeFieldsProps {
  values: AttributeFormValues;
  errors: AttributeFormErrors;
  mode: 'create' | 'edit';
  readOnly: boolean;
  set: (patch: Partial<AttributeFormValues>) => void;
}

/** Level, names, type, required / in use, default value and display order. */
export function AttributeMainFields({ values, errors, mode, readOnly, set }: AttributeFieldsProps) {
  const ids = { level: useId(), name: useId(), display: useId(), description: useId(), type: useId(), required: useId(), active: useId(), fallback: useId(), order: useId() };
  return (
    <>
      <FormField htmlFor={ids.level} label="Hierarchy level">
        <Select value={values.entityType} disabled={mode === 'edit'} onValueChange={(entityType) => set({ entityType: entityType as AttributeEntityType })}>
          <SelectTrigger id={ids.level}><SelectValue /></SelectTrigger>
          <SelectContent>{ATTRIBUTE_ENTITY_TYPES.map((type) => <SelectItem key={type} value={type}>{ATTRIBUTE_ENTITY_LABELS[type]}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor={ids.type} label="Type of value">
        <Select value={values.dataType} disabled={readOnly} onValueChange={(dataType) => set({ dataType: dataType as AttributeDataType })}>
          <SelectTrigger id={ids.type}><SelectValue /></SelectTrigger>
          <SelectContent>{ATTRIBUTE_DATA_TYPES.map((type) => <SelectItem key={type} value={type}>{ATTRIBUTE_DATA_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor={ids.display} label="Display name" hint="The label people see in forms." error={errors.displayName} required>
        <Input id={ids.display} value={values.displayName} disabled={readOnly} onChange={(e) => set({ displayName: e.target.value })} />
      </FormField>
      <FormField htmlFor={ids.name} label="Internal name" hint={mode === 'create' ? 'Lowercase, no spaces, e.g. location_code. Cannot change later.' : 'Cannot change.'} error={errors.name} required>
        <Input id={ids.name} value={values.name} disabled={mode === 'edit'} onChange={(e) => set({ name: e.target.value })} />
      </FormField>
      <div className="sm:col-span-2">
        <FormField htmlFor={ids.description} label="Help text">
          <Textarea id={ids.description} rows={2} value={values.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
        </FormField>
      </div>
      <FormField htmlFor={ids.fallback} label="Default value">
        <Input id={ids.fallback} value={values.defaultValue} disabled={readOnly} onChange={(e) => set({ defaultValue: e.target.value })} />
      </FormField>
      <FormField htmlFor={ids.order} label="Position" hint="Lower numbers come first; empty = last." error={errors.displayOrder}>
        <Input id={ids.order} inputMode="numeric" value={values.displayOrder} disabled={readOnly} onChange={(e) => set({ displayOrder: e.target.value })} />
      </FormField>
      <div className="flex items-center gap-2">
        <Switch id={ids.required} checked={values.isRequired} disabled={readOnly} onCheckedChange={(isRequired) => set({ isRequired })} />
        <Label htmlFor={ids.required}>Required</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id={ids.active} checked={values.isActive} disabled={readOnly} onCheckedChange={(isActive) => set({ isActive })} />
        <Label htmlFor={ids.active}>In use (shown in forms)</Label>
      </div>
    </>
  );
}

/** Length and pattern rules of text, limits of numbers, choices of a choice list. */
export function AttributeRuleFields({ values, errors, readOnly, set }: AttributeFieldsProps) {
  const ids = { minLength: useId(), maxLength: useId(), pattern: useId(), minValue: useId(), maxValue: useId(), options: useId() };
  const numberField = (key: 'minLength' | 'maxLength' | 'minValue' | 'maxValue', id: string, label: string) => (
    <FormField htmlFor={id} label={label} error={errors[key]}>
      <Input id={id} inputMode="decimal" value={values[key]} disabled={readOnly} onChange={(e) => set({ [key]: e.target.value })} />
    </FormField>
  );
  if (values.dataType === 'string') {
    return (
      <>
        {numberField('minLength', ids.minLength, 'Shortest length')}
        {numberField('maxLength', ids.maxLength, 'Longest length')}
        <div className="sm:col-span-2">
          <FormField htmlFor={ids.pattern} label="Pattern" hint="Optional regular expression the text must match.">
            <Input id={ids.pattern} value={values.pattern} disabled={readOnly} onChange={(e) => set({ pattern: e.target.value })} />
          </FormField>
        </div>
      </>
    );
  }
  if (values.dataType === 'number') {
    return (
      <>
        {numberField('minValue', ids.minValue, 'Smallest value')}
        {numberField('maxValue', ids.maxValue, 'Largest value')}
      </>
    );
  }
  if (values.dataType !== 'select') return null;
  return (
    <div className="sm:col-span-2">
      <FormField htmlFor={ids.options} label="Choices" hint="One choice per line." error={errors.options} required>
        <Textarea id={ids.options} rows={5} value={values.options} disabled={readOnly} onChange={(e) => set({ options: e.target.value })} />
      </FormField>
    </div>
  );
}
