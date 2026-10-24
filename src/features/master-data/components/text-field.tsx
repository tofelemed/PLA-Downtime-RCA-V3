import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequiredMarker } from '@/features/ux-kit/form-field';
import { Textarea } from '@/components/ui/textarea';
import { ReadOnlyField } from './read-only-field';

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  inputMode?: 'text' | 'decimal';
  placeholder?: string;
  maxLength?: number;
  /** opt-in: read-only users see the value as text under the label (no input, no hint) */
  asText?: boolean;
}

/** A labelled text input with its hint and error wired to `aria-describedby` / `aria-invalid`. */
export function TextField(props: TextFieldProps) {
  if (props.asText) return <ReadOnlyField label={props.label} value={props.value} multiline={props.multiline} />;
  return <EditableTextField {...props} />;
}

function EditableTextField(props: TextFieldProps) {
  const { id, label, value, onChange, error, hint, required, multiline, ...rest } = props;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    disabled: rest.disabled,
    placeholder: rest.placeholder,
    maxLength: rest.maxLength,
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      {multiline ? (
        <Textarea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input {...common} inputMode={rest.inputMode} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
