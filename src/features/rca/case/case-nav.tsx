import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCaseWorkspace } from './case-context';

const SECTIONS = [
  { path: '', label: 'Overview', testId: 'tab-overview', end: true },
  { path: '/evidence', label: 'Evidence', testId: 'tab-evidence', end: false },
  { path: '/analysis', label: 'Analysis', testId: 'tab-analysis', end: false },
  { path: '/actions', label: 'Recommendations & actions', testId: 'tab-actions', end: false },
  { path: '/links', label: 'Links & outcome', testId: 'tab-links', end: false },
  { path: '/history', label: 'History', testId: 'tab-history', end: false },
] as const;

/** Segmented tab of the case (same look as the RCA Analysis tab row): one row, scrolls sideways when narrow. */
const TAB_CLASS =
  'inline-flex items-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The six sub-pages of a case as links (each is its own route, so Back and bookmarks work). */
export function CaseNav() {
  const { basePath } = useCaseWorkspace();
  const { pathname, search } = useLocation();
  const currentPath = pathname.replace(/\/+$/, '');
  const active = (path: string) => path === ''
    ? currentPath === basePath || currentPath === `${basePath}/definition`
    : currentPath === `${basePath}${path}` || currentPath.startsWith(`${basePath}${path}/`);
  return (
    <nav aria-label="Investigation sections" className="max-w-full overflow-x-auto">
      <ul className="inline-flex items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
        {SECTIONS.map((section) => {
          const isActive = active(section.path);
          return (
            <li key={section.testId}>
              <Link
                to={`${basePath}${section.path}${search}`}
                data-testid={section.testId}
                data-state={isActive ? 'active' : 'inactive'}
                aria-current={isActive ? 'page' : undefined}
                className={cn(TAB_CLASS, isActive ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground')}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
