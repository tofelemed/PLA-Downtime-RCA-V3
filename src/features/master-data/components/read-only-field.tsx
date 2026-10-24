import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ReadOnlyFieldProps {
  label: string;
  /** the stored value as text; empty shows a dash */
  value: ReactNode;
  /** keeps the line breaks of a long text */
  multiline?: boolean;
}

/** A field read-only users see (Plant & equipment cleanup, 25 Oct 2026): its label over the value as text, never a disabled input. */
export function ReadOnlyField({ label, value, multiline }: ReadOnlyFieldProps) {
  const empty = value === '' || value === null || value === undefined;
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-sm font-medium leading-none">{label}</p>
      <p className={cn('text-sm', multiline && 'whitespace-pre-wrap', empty && 'text-muted-foreground')}>{empty ? '—' : value}</p>
    </div>
  );
}
