import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export interface FinanceFieldProps {
  id: string;
  label: string;
  /** browser check or server 422 message for this field */
  error?: string;
  hint?: string;
  children: ReactNode;
  /** false for controls that carry their own label (date inputs render a legend) */
  withLabel?: boolean;
}

/** Label, control and the field's message, linked for screen readers. */
export function FinanceField({ id, label, error, hint, children, withLabel = true }: FinanceFieldProps) {
  return (
    <div className="space-y-1">
      {withLabel && <Label htmlFor={id}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive" data-testid={`field-error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
