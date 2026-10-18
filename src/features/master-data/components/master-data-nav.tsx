import { NavLink } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { cn } from '@/lib/utils';
import { visibleMasterDataSections } from './master-data-sections';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * The master-data sections the user may open as one wrapping row of links (sub-pages instead of
 * overflowing tabs); codes and rules belong here; users stay in User Management.
 */
export function MasterDataNav() {
  const capabilities = useCapabilities();
  return (
    <nav aria-label="Master data sections" className="flex flex-wrap items-center gap-1 border-b pb-2">
      {visibleMasterDataSections(capabilities).map((section) => (
        <NavLink key={section.to} to={section.to} end={section.end} className={linkClass}>
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
