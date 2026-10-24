import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FactListProps {
  children: ReactNode;
  testId?: string;
  className?: string;
}

/** Read-only key–value block: a definition-list grid, muted one-line labels on the left, wrapping values. */
export function FactList({ children, testId, className }: FactListProps) {
  return (
    <dl className={cn('grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm', className)} data-testid={testId}>
      {children}
    </dl>
  );
}

export interface FactProps {
  label: string;
  children: ReactNode;
  /** long free text: kept to a readable line length, line breaks kept */
  long?: boolean;
}

/** One label and value of a {@link FactList}; an empty value shows "—". */
export function Fact({ label, children, long = false }: FactProps) {
  const empty = children === null || children === undefined || children === '' || children === false;
  return (
    <>
      <dt className="truncate text-muted-foreground" title={label}>
        {label}
      </dt>
      <dd className={cn('min-w-0 break-words', long && 'max-w-[75ch] whitespace-pre-wrap')}>{empty ? '—' : children}</dd>
    </>
  );
}
