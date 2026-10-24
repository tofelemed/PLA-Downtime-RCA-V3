import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { cn } from '@/lib/utils';

export interface FilterFieldProps {
  /** id of the control the label names */
  id: string;
  label: string;
  /** width of the control (default w-48) */
  className?: string;
  children: ReactNode;
}

/** A control of a filter row with its label stacked above it (the row is `flex flex-wrap items-end`). */
export function FilterField({ id, label, className = 'w-full sm:w-48', children }: FilterFieldProps) {
  return (
    <div className={cn(FIELD_CLASS, className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
