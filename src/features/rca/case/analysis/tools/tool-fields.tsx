import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';
import { cn } from '@/lib/utils';
import { useCaseWorkspace } from '../../case-context';
import type { ChoiceOption } from './tool-choices';

/** A saved value as text (read-only mode): label above, the value wrapped at ~75 characters, "Not recorded" when empty. */
export function ReadField({ label, value, className, testId }: { label: string; value: ReactNode; className?: string; testId?: string }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={cn('min-w-0 space-y-1', className)} data-testid={testId}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="min-h-9 max-w-[75ch] whitespace-pre-wrap break-words py-1.5 text-sm">
        {empty ? <span className="text-muted-foreground">Not recorded</span> : value}
      </p>
    </div>
  );
}

export interface ToolTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** a textarea (3 rows or more) instead of a one-line input */
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
  error?: string | null;
  className?: string;
}

/** A labelled, always editable text field: an input (h-9) or a textarea of 3 rows or more (dialogs and editors). */
export function TextInputField({ id, label, value, onChange, multiline, maxLength, required, error, className }: ToolTextFieldProps) {
  return (
    <FormField id={id} label={label} required={required} error={error} className={className}>
      {multiline ? (
        <Textarea id={id} rows={3} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} className="h-9" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}

/** A labelled text field of an analysis tool: editable while the case is, text on a read-only case. */
export function ToolTextField(props: ToolTextFieldProps) {
  const { readOnly } = useCaseWorkspace();
  if (readOnly) return <ReadField label={props.label} value={props.value} className={props.className} />;
  return <TextInputField {...props} />;
}

const NONE = '__none__';

export interface ChoiceSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly ChoiceOption[];
  onChange: (value: string) => void;
  /** adds an empty choice with this text that maps to '' */
  allowNone?: string;
  className?: string;
}

/** A labelled select (h-9) over fixed options, always editable (dialogs). */
export function ChoiceSelect({ id, label, value, options, onChange, allowNone, className }: ChoiceSelectProps) {
  return (
    <FormField id={id} label={label} className={className}>
      <Select value={value === '' ? NONE : value} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone !== undefined && <SelectItem value={NONE}>{allowNone}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/** A choice of an analysis tool: a select while editable, the chosen option's words on a read-only case. */
export function ToolChoiceField(props: ChoiceSelectProps) {
  const { readOnly } = useCaseWorkspace();
  if (!readOnly) return <ChoiceSelect {...props} />;
  const chosen = props.options.find((option) => option.value === props.value)?.label ?? (props.value === '' ? props.allowNone : props.value);
  return <ReadField label={props.label} value={chosen} className={props.className} />;
}
