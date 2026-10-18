import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { sectionsFor } from '../model/period-navigation';

/** Real child-page links keep bookmarks and browser history usable. */
export function PeriodSectionNav({ basePath, search }: { basePath: string; search: string }) {
  const { canViewAnalysis } = useCapabilities();
  return (
    <nav aria-label="Period sections" className="border-b">
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {sectionsFor(canViewAnalysis).map(({ path, label }) => (
          <li key={path}>
            <NavLink to={`${basePath}${path ? `/${path}` : ''}${search}`} end className={({ isActive }) => cn(
              'inline-block border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>{label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
