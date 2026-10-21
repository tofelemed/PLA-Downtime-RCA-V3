import { NavLink, useLocation } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { cn } from '@/lib/utils';
import { masterDataGroupOf, visibleMasterDataSections } from './master-data-sections';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * The pages of the current Setup entry the user may open, as one wrapping row of links ("Plant & equipment":
 * units, assets, products, hierarchy, plant flow; 21 Oct 2026). Nothing when the entry has a single page.
 */
export function MasterDataNav() {
  const capabilities = useCapabilities();
  const group = masterDataGroupOf(useLocation().pathname);
  const sections = visibleMasterDataSections(capabilities).filter((section) => section.group === group);
  if (sections.length < 2) return null;
  return (
    <nav aria-label="Pages of this setup area" className="flex flex-wrap items-center gap-1 border-b pb-2">
      {sections.map((section) => (
        <NavLink key={section.to} to={section.to} end={section.end} className={linkClass}>
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
