import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';

/** Small labelled controls shared by the RCA forms (every input has a visible label; kit `FormField`). */
export function Field({ id, label, wide, required, children }: { id: string; label: string; wide?: boolean; required?: boolean; children: ReactNode }) {
  return (
    <FormField id={id} label={label} required={required} className={wide ? 'md:col-span-2' : undefined}>
      {children}
    </FormField>
  );
}

export function TextField(props: { id: string; label: string; value: string; onChange: (value: string) => void; wide?: boolean; maxLength?: number; placeholder?: string; required?: boolean }) {
  return (
    <Field id={props.id} label={props.label} wide={props.wide} required={props.required}>
      <Input id={props.id} value={props.value} maxLength={props.maxLength} placeholder={props.placeholder} required={props.required} onChange={(e) => props.onChange(e.target.value)} />
    </Field>
  );
}

export function AreaField(props: { id: string; label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  return (
    <Field id={props.id} label={props.label} wide>
      <Textarea id={props.id} value={props.value} maxLength={props.maxLength} onChange={(e) => props.onChange(e.target.value)} />
    </Field>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
}

const NONE = '__none__';

/** A select over fixed options; `allowNone` adds an empty choice that maps to ''. */
export function ChoiceField(props: { id: string; label: string; value: string; options: readonly ChoiceOption[]; onChange: (value: string) => void; allowNone?: string }) {
  return (
    <Field id={props.id} label={props.label}>
      <Select value={props.value === '' ? NONE : props.value} onValueChange={(next) => props.onChange(next === NONE ? '' : next)}>
        <SelectTrigger id={props.id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.allowNone !== undefined && <SelectItem value={NONE}>{props.allowNone}</SelectItem>}
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export const optionsOf = (values: readonly string[]): ChoiceOption[] => values.map((value) => ({ value, label: value }));
