import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export interface FormFieldProps {
  id: string;
  label: string;
  /** server (422 fieldErrors) or request-shape message for this field */
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label, control and the field's error, linked for screen readers. */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" data-testid={`field-error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
