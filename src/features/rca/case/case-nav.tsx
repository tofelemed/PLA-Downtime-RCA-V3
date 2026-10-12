import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCaseWorkspace } from './case-context';

const SECTIONS = [
  { path: '', label: 'Overview', testId: 'tab-overview', end: true },
  { path: '/evidence', label: 'Evidence', testId: 'tab-evidence', end: false },
  { path: '/analysis', label: 'Analysis', testId: 'tab-analysis', end: false },
  { path: '/actions', label: 'Recommendations & actions', testId: 'tab-actions', end: false },
  { path: '/links', label: 'Links & outcome', testId: 'tab-links', end: false },
] as const;

/** The five sub-pages of a case as links (each is its own route, so Back and bookmarks work). */
export function CaseNav() {
  const { basePath } = useCaseWorkspace();
  return (
    <nav aria-label="Case sections" className="border-b">
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {SECTIONS.map((section) => (
          <li key={section.testId}>
            <NavLink
              to={`${basePath}${section.path}`}
              end={section.end}
              data-testid={section.testId}
              className={({ isActive }) =>
                cn(
                  'inline-block border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
