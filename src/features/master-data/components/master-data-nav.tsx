import { NavLink } from 'react-router-dom';
import { ActionIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface SectionLink {
  to: string;
  label: string;
  /** exact match only (the overview) */
  end?: boolean;
}

const SECTIONS: readonly SectionLink[] = [
  { to: '/master-data', label: 'Overview', end: true },
  { to: '/master-data/units', label: 'Units' },
  { to: '/master-data/assets', label: 'Assets' },
  { to: '/master-data/products', label: 'Products' },
  { to: '/master-data/hierarchy', label: 'Plant hierarchy' },
  { to: '/master-data/rca/templates', label: 'RCA templates' },
  { to: '/master-data/rca/causes', label: 'Cause library' },
  { to: '/master-data/rca/checklists', label: 'Verification checklists' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * The master-data sections as one wrapping row of links (sub-pages instead of eight overflowing tabs);
 * codes live in Codes & rules, users in User management.
 */
export function MasterDataNav() {
  return (
    <nav aria-label="Master data sections" className="flex flex-wrap items-center gap-1 border-b pb-2">
      {SECTIONS.map((section) => (
        <NavLink key={section.to} to={section.to} end={section.end} className={linkClass}>
          {section.label}
        </NavLink>
      ))}
      <NavLink to="/codes-admin" className={linkClass({ isActive: false })}>
        <span className="inline-flex items-center gap-1">
          Codes & rules
          <ActionIcon.open aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </NavLink>
    </nav>
  );
}
