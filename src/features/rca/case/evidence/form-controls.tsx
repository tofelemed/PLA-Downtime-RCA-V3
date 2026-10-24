import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { FormField } from '@/features/ux-kit/form-field';

/** Small labelled controls shared by the RCA forms (label above, h-9 control, message under it; kit `FormField`). */
export function Field({ id, label, wide, required, error, children }: { id: string; label: string; wide?: boolean; required?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <FormField id={id} label={label} required={required} error={error} className={wide ? 'md:col-span-2' : undefined}>
      {children}
    </FormField>
  );
}

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  /** validation message shown under the field */
  error?: string | null;
  onBlur?: () => void;
}

export function TextField(props: TextFieldProps) {
  return (
    <Field id={props.id} label={props.label} wide={props.wide} required={props.required} error={props.error}>
      <Input
        id={props.id}
        className="h-9"
        value={props.value}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        required={props.required}
        onBlur={props.onBlur}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  );
}

export function AreaField(props: { id: string; label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  return (
    <Field id={props.id} label={props.label} wide>
      <Textarea id={props.id} rows={3} value={props.value} maxLength={props.maxLength} onChange={(e) => props.onChange(e.target.value)} />
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
        <SelectTrigger id={props.id} className="h-9">
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

/** A titled group of fields inside a form card (h3, optional ⓘ), fields in a two-column grid from md. */
export function FieldGroup({ title, info, children }: { title: string; info?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {info && <KpiInfo label={title} text={info} />}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** Form footer: an optional destructive action on the left; Cancel, then the primary, on the right. */
export function FormFooter({ start, children }: { start?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4" data-testid="form-footer">
      <div className="flex flex-wrap items-center gap-2">{start}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
