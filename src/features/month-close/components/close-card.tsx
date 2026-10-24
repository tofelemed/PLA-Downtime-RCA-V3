import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { cn } from '@/lib/utils';

export interface CloseCardProps {
  title: string;
  /** shown in brackets after the title */
  count?: string;
  /** what the card means; shown in the info tooltip next to the title */
  info?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A page block of the month close: card with an h2 title, optional count and info tooltip, actions on the right. */
export function CloseCard({ title, count, info, actions, className, children }: CloseCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-lg border bg-card p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 id={id} className="text-base font-semibold text-heading">
            {title}
            {count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground">({count})</span>}
          </h2>
          {info && <KpiInfo label={title} text={info} />}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
