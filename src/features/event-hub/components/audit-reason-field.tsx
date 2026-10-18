import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';

export interface AuditReasonFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  className?: string;
}

/** The required "Why" of an event command, kept in the revision history (H-5). */
export function AuditReasonField({ id, value, onChange, maxLength, className }: AuditReasonFieldProps) {
  return (
    <FormField id={id} label="Why (kept in the history)" required hint="A reason is required for the audit history." className={className}>
      <Textarea id={id} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}
