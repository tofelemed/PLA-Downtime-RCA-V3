import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface KpiSectionLink {
  to: string;
  label: string;
  testId?: string;
}

export interface KpiSectionProps {
  title: string;
  link?: KpiSectionLink;
  /** several links in the header's link area (each already gated by the caller) */
  links?: readonly KpiSectionLink[];
  controls?: ReactNode;
  children: ReactNode;
}

/** One dashboard card: h2 title on the left, controls and the report link on the right, then the content. */
export function KpiSection({ title, link, links, controls, children }: KpiSectionProps) {
  const headingId = useId();
  const allLinks = [...(links ?? []), ...(link ? [link] : [])];
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-base font-semibold text-heading">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {controls}
          {allLinks.map((item) => (
            <Link key={item.to} to={item.to} data-testid={item.testId} className="text-sm font-medium text-primary hover:underline">
              {item.label} →
            </Link>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
