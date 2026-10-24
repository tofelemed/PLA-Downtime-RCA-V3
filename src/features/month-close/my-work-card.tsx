import type { ReactNode } from 'react';
import { useId } from 'react';

export interface MyWorkCardProps {
  title: string;
  /** shown next to the title, e.g. the row count */
  count?: string;
  /** the ⓘ next to the title */
  info?: ReactNode;
  /** right of the title, e.g. a link to the full list */
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}

/** A My work table card: h2 title (with count and ⓘ), actions right, the table below. */
export function MyWorkCard({ title, count, info, actions, children, testId }: MyWorkCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-testid={testId} className="min-w-0 rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-1.5 text-base font-semibold text-heading">
          {title}
          {count && <span className="font-normal text-muted-foreground">({count})</span>}
          {info}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
