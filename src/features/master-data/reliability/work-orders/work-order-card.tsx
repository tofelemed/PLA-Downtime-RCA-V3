import type { ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

export interface WorkOrderCardProps {
  id: string;
  title: string;
  /** the ⓘ next to the title: what the card's figures or inputs mean */
  info: { label: string; text: ReactNode };
  children: ReactNode;
}

/** A page card of the work-order page: h2 title with its ⓘ, then the content. */
export function WorkOrderCard({ id, title, info, children }: WorkOrderCardProps) {
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <h2 id={id} className="text-base font-semibold text-heading">{title}</h2>
        <KpiInfo label={info.label} text={info.text} />
      </div>
      {children}
    </section>
  );
}
