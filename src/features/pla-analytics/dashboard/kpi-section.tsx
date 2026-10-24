import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface KpiSectionProps {
  title: string;
  link?: { to: string; label: string; testId?: string };
  controls?: ReactNode;
  children: ReactNode;
}

/** One dashboard card: h2 title on the left, controls and the report link on the right, then the content. */
export function KpiSection({ title, link, controls, children }: KpiSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-base font-semibold">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {controls}
          {link && (
            <Link to={link.to} data-testid={link.testId} className="text-sm font-medium text-primary hover:underline">
              {link.label} →
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
