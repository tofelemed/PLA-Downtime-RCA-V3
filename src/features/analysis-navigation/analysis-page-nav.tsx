import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { analysisHref } from './analysis-pages';

interface AnalysisPageNavProps {
  label: string;
  pages: readonly { path: string; label: string }[];
}

/** Real page links stay usable with a collapsed sidebar, keyboard, Back and shared URLs. */
export function AnalysisPageNav({ label, pages }: AnalysisPageNavProps) {
  const location = useLocation();
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 border-b pb-3">
      {pages.map((page) => (
        <Link key={page.path} to={analysisHref(page.path, location)} aria-current={location.pathname === page.path ? 'page' : undefined}
          className={cn('rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', location.pathname === page.path ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
