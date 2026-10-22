import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** One page of a Setup area: a list page, or a tab of one kept in the query (`/finance?tab=fx`). */
export interface AreaTab {
  key: string;
  label: string;
  to: string;
  testId?: string;
}

export interface AreaTabsProps {
  tabs: readonly AreaTab[];
  /** key of the highlighted tab: the list page, or on a sub-page the list its record belongs to */
  current: string | null;
}

const linkClass = (active: boolean) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * The one tab row of a Setup area (DECISIONS 2026-10-22): a wrapping row of links under the page header, on
 * the list pages and on their record / form sub-pages alike. Nothing when the area has a single page.
 */
export function AreaTabs({ tabs, current }: AreaTabsProps) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Pages of this setup area" className="flex flex-wrap items-center gap-1 border-b pb-2">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link key={tab.key} to={tab.to} aria-current={active ? 'page' : undefined} className={linkClass(active)} data-testid={tab.testId}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
