import { NavLink } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { visibleMasterDataSections } from './master-data-sections';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * The master-data sections the user may open as one wrapping row of links (sub-pages instead of
 * overflowing tabs); codes live in Codes & rules, users in User management.
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
      {capabilities.canManageMasterData && (
        <NavLink to="/codes-admin" className={linkClass({ isActive: false })}>
          <span className="inline-flex items-center gap-1">
            Codes & rules
            <ActionIcon.open aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        </NavLink>
      )}
    </nav>
  );
}
