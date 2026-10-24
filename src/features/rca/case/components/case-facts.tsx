import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CaseFactsLayout = 'columns' | 'stacked';

export interface CaseFactsProps {
  /** `columns` (default): label column + value column; `stacked`: label above value (narrow side columns) */
  layout?: CaseFactsLayout;
  testId?: string;
  className?: string;
  children: ReactNode;
}

const LAYOUT_CLASS: Readonly<Record<CaseFactsLayout, string>> = {
  columns: 'grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] sm:gap-y-2',
  stacked: 'grid grid-cols-1 gap-y-1',
};

/** A read-only key–value block of a case page: a definition list grid, labels muted, values wrapping. */
export function CaseFacts({ layout = 'columns', testId, className, children }: CaseFactsProps) {
  return (
    <dl className={cn('min-w-0 text-sm', LAYOUT_CLASS[layout], className)} data-testid={testId}>
      {children}
    </dl>
  );
}

export interface CaseFactProps {
  label: ReactNode;
  children: ReactNode;
  /** a muted secondary line under the value (text-xs) */
  note?: ReactNode;
  testId?: string;
}

/**
 * One label and value of `CaseFacts`. Long texts keep their line breaks and stop at ~75 characters per line;
 * an empty value reads "Not recorded".
 */
export function CaseFact({ label, children, note, testId }: CaseFactProps) {
  const empty = children === null || children === undefined || (typeof children === 'string' && children.trim() === '');
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mb-2 min-w-0 max-w-[75ch] whitespace-pre-wrap break-words last:mb-0 sm:mb-0" data-testid={testId}>
        {empty ? <span className="text-muted-foreground">Not recorded</span> : children}
        {note && <span className="mt-1 block text-xs text-muted-foreground">{note}</span>}
      </dd>
    </>
  );
}
