import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export interface FormFieldProps {
  /** id of the control the label names */
  htmlFor: string;
  label: string;
  /** short help under the control */
  hint?: string;
  /** validation message; shown in the destructive colour with an alert role */
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}

/** Label, control, hint and error of one form field (the control sets `aria-describedby` itself if needed). */
export function FormField({ htmlFor, label, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
